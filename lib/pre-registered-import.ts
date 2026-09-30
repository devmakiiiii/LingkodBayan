/**
 * Parsing helpers for the pre-registered residents bulk import.
 *
 * Admins can upload either a CSV file or an Excel workbook (`.xlsx` / `.xlsm`).
 * Both formats are normalised into the same `string[][]` shape — a header row
 * followed by data rows — so the API route can validate and insert them with a
 * single code path.
 *
 * Excel parsing is delegated to `exceljs`, which is already a dependency used
 * for report exports. It is imported lazily so the module stays lightweight
 * when only CSV is uploaded.
 */

import { z } from 'zod'

import {
  BARANGAY_CITY,
  BARANGAY_DISPLAY_NAME,
  BARANGAY_PROVINCE,
  canonicalBarangayName,
} from './schemas.ts'

export type ImportFormat = 'csv' | 'xlsx' | 'unsupported'

/**
 * Decide how an uploaded file should be parsed based on its filename.
 *
 * Legacy binary `.xls` workbooks are not supported by exceljs and are reported
 * as `unsupported` (users are asked to save as `.xlsx` instead).
 */
export function resolveImportFormat(fileName: string): ImportFormat {
  const name = (fileName || '').trim().toLowerCase()
  if (name.endsWith('.csv')) return 'csv'
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return 'xlsx'
  return 'unsupported'
}

// Minimal structural types for the parts of the exceljs API we rely on. Keeping
// them local avoids depending on exceljs' ambient declarations, which augment
// the global `Buffer` interface.
type ExcelCellLike = { value: unknown }
type ExcelRowLike = { getCell(col: number): ExcelCellLike }
type ExcelWorksheetLike = {
  columnCount: number
  eachRow(options: { includeEmpty: boolean }, callback: (row: ExcelRowLike) => void): void
}
type ExcelWorkbookLike = {
  xlsx: { load(data: Uint8Array): Promise<unknown> }
  worksheets: ExcelWorksheetLike[]
}
type ExcelWorkbookConstructor = new () => ExcelWorkbookLike

/**
 * Convert a single Excel cell value into the plain string the CSV pipeline
 * expects. Handles the value shapes exceljs can return: primitives, `Date`,
 * rich text, hyperlinks, formulas and error cells.
 */
export function excelCellValueToString(value: unknown): string {
  if (value === null || value === undefined) return ''

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    // Excel stores dates as timezone-naive serial numbers; exceljs decodes them
    // against UTC, so read the UTC parts to avoid an off-by-one-day shift when
    // the server runs in a non-UTC timezone.
    const year = value.getUTCFullYear()
    const month = String(value.getUTCMonth() + 1).padStart(2, '0')
    const day = String(value.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.richText)) {
      return record.richText
        .map((part) =>
          part && typeof part === 'object' ? String((part as { text?: unknown }).text ?? '') : '',
        )
        .join('')
    }
    // Formula cell: fall back to its cached result.
    if ('result' in record) return excelCellValueToString(record.result)
    // Hyperlink cell: use the display text when present.
    if (typeof record.text === 'string') return record.text
    if (typeof record.hyperlink === 'string') return record.hyperlink
    // Error cells ({ error: '#N/A' }) carry no usable value.
    return ''
  }

  return String(value)
}

/**
 * Read the first worksheet of an Excel workbook into a `string[][]` matrix.
 * Empty rows are skipped, matching the CSV importer's behaviour.
 */
export async function parseExcelToRows(data: Uint8Array | ArrayBufferLike): Promise<string[][]> {
  const mod = (await import('exceljs')) as unknown as {
    Workbook?: ExcelWorkbookConstructor
    default?: { Workbook?: ExcelWorkbookConstructor }
  }
  const WorkbookCtor = mod.Workbook ?? mod.default?.Workbook
  if (!WorkbookCtor) {
    throw new Error('exceljs is not available in this environment.')
  }

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const workbook = new WorkbookCtor()
  await workbook.xlsx.load(bytes)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const rows: string[][] = []
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = []
    for (let col = 1; col <= worksheet.columnCount; col += 1) {
      values.push(excelCellValueToString(row.getCell(col).value))
    }
    rows.push(values)
  })

  return rows
}

// ---------------------------------------------------------------------------
// CSV / JSON import row validation
//
// Admins seed the registry from barangay household records, which frequently
// carry no email address (they are typed up from a census sheet, not from a
// sign-up form). A blank email is therefore accepted and stored as NULL;
// identity matching still relies on the name / DOB / address signals (see
// `findPreRegisteredCandidates`). An email, when supplied, must be valid.
// ---------------------------------------------------------------------------

/** Columns recognised in an uploaded CSV/Excel file, in the documented order. */
export const IMPORT_COLUMNS = [
  'first_name',
  'last_name',
  'middle_name',
  'date_of_birth',
  'email',
  'phone',
  'street_address',
  'barangay',
  'city_municipality',
  'province',
  'postal_code',
  'national_id',
  'id_type',
] as const

/**
 * Columns that MUST appear in the header row. `email` is deliberately absent:
 * the whole contact column may be omitted, and individual rows may leave it
 * blank (see the note above).
 */
export const REQUIRED_IMPORT_COLUMNS = ['first_name', 'last_name'] as const

const IMPORT_ID_TYPES = [
  'philsys',
  'drivers_license',
  'passport',
  'voter',
  'sss',
  'tin',
  'umid',
] as const

/**
 * Validation for a single imported row. Only the two names are mandatory; an
 * email, when supplied, must look like an address.
 */
export const importRowSchema = z.object({
  first_name: z
    .string({ required_error: 'First name is required' })
    .trim()
    .min(1, 'First name is required'),
  last_name: z
    .string({ required_error: 'Last name is required' })
    .trim()
    .min(1, 'Last name is required'),
  middle_name: z.string().trim().optional().or(z.literal('')),
  date_of_birth: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((val) => {
      if (!val) return true
      const date = new Date(val)
      if (Number.isNaN(date.getTime())) return false
      return date <= new Date()
    }, 'Invalid date format (expected YYYY-MM-DD)'),
  // Blank / missing is allowed; a non-empty value must be a valid address.
  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || z.string().email().safeParse(val).success,
      'Invalid email format',
    ),
  phone: z.string().trim().optional().or(z.literal('')),
  street_address: z.string().trim().optional().or(z.literal('')),
  barangay: z.string().trim().optional().or(z.literal('')),
  city_municipality: z.string().trim().optional().or(z.literal('')),
  province: z.string().trim().optional().or(z.literal('')),
  postal_code: z.string().trim().optional().or(z.literal('')),
  national_id: z.string().trim().optional().or(z.literal('')),
  id_type: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (IMPORT_ID_TYPES as readonly string[]).includes(val),
      'Invalid ID type',
    ),
})

export type ImportRow = z.infer<typeof importRowSchema>

/** A validated row, shaped exactly like a `pre_registered_residents` insert. */
export type PreRegisteredImportRecord = {
  first_name: string
  last_name: string
  middle_name: string | null
  date_of_birth: string | null
  email: string | null
  phone: string | null
  street_address: string | null
  barangay: string
  city_municipality: string
  province: string
  postal_code: string | null
  national_id: string | null
  id_type: string | null
  source: string
  import_batch_id: string
}

export type ImportRecordResult =
  | { ok: true; record: PreRegisteredImportRecord }
  | { ok: false; errors: string[] }

/**
 * Validate one raw import row and build the database-shaped record.
 *
 * Blank emails become `null` (matching the nullable column), phone numbers are
 * reduced to digits, and the barangay is canonicalised: a blank value defaults
 * to the system barangay while any other barangay is rejected.
 */
export function buildPreRegisteredImportRecord(
  raw: Record<string, unknown>,
  meta: { source: string; importBatchId: string },
): ImportRecordResult {
  const parsed = importRowSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.errors.map((e) => e.message) }
  }

  const row = parsed.data

  const barangay = canonicalBarangayName(row.barangay)
  if (!barangay) {
    return {
      ok: false,
      errors: [
        `Row lists "${row.barangay}", but this system only serves ${BARANGAY_DISPLAY_NAME}.`,
      ],
    }
  }

  const phoneDigits = row.phone ? row.phone.replace(/\D/g, '') : ''

  return {
    ok: true,
    record: {
      first_name: row.first_name,
      last_name: row.last_name,
      middle_name: row.middle_name || null,
      date_of_birth: row.date_of_birth || null,
      email: row.email ? row.email.toLowerCase() : null,
      phone: phoneDigits || null,
      street_address: row.street_address || null,
      barangay,
      city_municipality: row.city_municipality || BARANGAY_CITY,
      province: row.province || BARANGAY_PROVINCE,
      postal_code: row.postal_code || null,
      national_id: row.national_id || null,
      id_type: row.id_type || null,
      source: meta.source,
      import_batch_id: meta.importBatchId,
    },
  }
}
