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

// ---------------------------------------------------------------------------
// Header detection for barangay spreadsheets
//
// Office exports are not flat snake_case tables. The barangay's RBI form
// ("Record of Barangay Inhabitants by Household", one sheet per purok) has a
// title/metadata block, stacked multi-row headers ("DATE OF" above "BIRTH"),
// numbering rows ("1.1"…"8") and human-readable labels ("LAST NAME").
// `detectImportColumns` finds the header row, merges the stacked label rows
// and resolves each column through an alias table so those files import
// without manual reformatting. Plain CSVs with snake_case headers resolve on
// the first row exactly as before.
// ---------------------------------------------------------------------------

/** A canonical import column name (one of IMPORT_COLUMNS). */
export type ImportColumn = (typeof IMPORT_COLUMNS)[number]

/** Lowercase and strip everything but letters/digits: "Last Name" → "lastname". */
export function normalizeHeaderCell(value: string): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Human-readable header variants → canonical import columns. */
const HEADER_ALIASES: Record<string, ImportColumn> = {
  firstname: 'first_name',
  givenname: 'first_name',
  lastname: 'last_name',
  surname: 'last_name',
  apelyido: 'last_name',
  middlename: 'middle_name',
  middleinitial: 'middle_name',
  dateofbirth: 'date_of_birth',
  birthdate: 'date_of_birth',
  dob: 'date_of_birth',
  email: 'email',
  emailaddress: 'email',
  phone: 'phone',
  phonenumber: 'phone',
  mobileno: 'phone',
  contactno: 'phone',
  contactnumber: 'phone',
  cellphone: 'phone',
  streetaddress: 'street_address',
  streetname: 'street_address',
  street: 'street_address',
  addressline1: 'street_address',
  completeaddress: 'street_address',
  address: 'street_address',
  barangay: 'barangay',
  citymunicipality: 'city_municipality',
  city: 'city_municipality',
  municipality: 'city_municipality',
  province: 'province',
  postalcode: 'postal_code',
  zip: 'postal_code',
  zipcode: 'postal_code',
  nationalid: 'national_id',
  idnumber: 'national_id',
  idtype: 'id_type',
}

/**
 * Columns that only hold a fragment of the address. House-number style
 * columns ("NO.", "House No.") are placed before the street name and
 * sitio/purok/zone columns after it, matching Philippine address order:
 * "6, Albay St., Purok 2".
 */
const ADDRESS_PREFIX_KEYS = new Set(['no', 'houseno', 'housenumber', 'lotno', 'unitno'])
const ADDRESS_SUFFIX_KEYS = new Set(['purok', 'sitio', 'zone', 'subdivision', 'village'])

type ColumnRole =
  | { kind: 'field'; field: ImportColumn }
  | { kind: 'address-part'; position: 'prefix' | 'suffix' }
  | { kind: 'ignored' }

function resolveFieldAlias(normalized: string): ImportColumn | null {
  const exact = HEADER_ALIASES[normalized]
  if (exact) return exact
  // Stacked headers concatenate when merged ("NAME (1)" above "LAST NAME"
  // becomes "name1lastname"), so also accept the longest alias the label
  // ends with. Short keys (<= 4 chars, e.g. "city", "zip", "dob") stay
  // exact-match only to avoid collisions like "electricity" ending in "city".
  let best: ImportColumn | null = null
  let bestKey = ''
  for (const [key, field] of Object.entries(HEADER_ALIASES)) {
    if (key.length >= 5 && normalized.endsWith(key) && key.length > bestKey.length) {
      best = field
      bestKey = key
    }
  }
  return best
}

function resolveColumnRole(label: string): ColumnRole {
  const normalized = normalizeHeaderCell(label)
  if (!normalized) return { kind: 'ignored' }

  const field = resolveFieldAlias(normalized)
  if (field) return { kind: 'field', field }

  if (ADDRESS_PREFIX_KEYS.has(normalized)) return { kind: 'address-part', position: 'prefix' }
  if (ADDRESS_SUFFIX_KEYS.has(normalized)) return { kind: 'address-part', position: 'suffix' }
  // Stacked sitio/purok labels arrive messy ("NAME OF SB DIVISION/ZONE"
  // merged with "SITIO/PUROK(if applicable)"), so part keys also match by
  // containment. Prefix keys stay exact-only: "E. HOUSEHOLD NO.:" in the
  // metadata block must never be read as a house number.
  for (const key of ADDRESS_SUFFIX_KEYS) {
    if (normalized.includes(key)) return { kind: 'address-part', position: 'suffix' }
  }
  return { kind: 'ignored' }
}

/** How far below the first row we look for the header anchor row. */
const HEADER_SCAN_ROWS = 15
/** Maximum stacked label rows merged into the header. */
const MAX_LABEL_ROWS = 5
/** Maximum rows walked below the anchor before forcing the data section. */
const MAX_HEADER_WALK = 8

function cellText(value: string | undefined): string {
  return (value ?? '').trim()
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cellText(cell) === '')
}

/** The "1.1" … "8" ruler row under stacked headers carries no data. */
function isNumberingRow(row: string[]): boolean {
  const filled = row.map(cellText).filter((cell) => cell !== '')
  return filled.length > 0 && filled.every((cell) => /^\d+(\.\d+)?$/.test(cell))
}

/** Resolved header → data-row layout for an uploaded CSV/Excel file. */
export type ImportColumnPlan = {
  /** Index (into the rows matrix) of the header anchor row. */
  headerRowIndex: number
  /** Index of the first data row; everything before it is header/metadata. */
  dataRowIndex: number
  /** Canonical import field → column index. */
  fieldColumns: Map<ImportColumn, number>
  /** Columns folded in front of / after the street name in street_address. */
  addressPrefixColumns: number[]
  addressSuffixColumns: number[]
  /** Merged header labels, per column, for error messages. */
  headerLabels: string[]
  /** Required fields the headers did not resolve to. */
  missingRequired: ImportColumn[]
}

/**
 * Locate and resolve the header of an uploaded file.
 *
 * The anchor row is the row in the scan window that resolves the most import
 * fields. Stacked label rows directly below it ("BIRTH" completing
 * "DATE OF", "SITIO/PUROK(if applicable)") are merged in while they either
 * complete a new field or carry no values under columns already resolved as
 * data. Numbering and blank rows are skipped. The first row that does not
 * extend the header becomes the start of the data section.
 */
export function detectImportColumns(rows: string[][]): ImportColumnPlan {
  const scanEnd = Math.min(rows.length, HEADER_SCAN_ROWS)

  let headerRowIndex = 0
  let bestScore = -1
  for (let i = 0; i < scanEnd; i++) {
    const seen = new Set<ImportColumn>()
    for (const cell of rows[i] ?? []) {
      const role = resolveColumnRole(cell)
      if (role.kind === 'field' && !seen.has(role.field)) seen.add(role.field)
    }
    if (seen.size > bestScore) {
      bestScore = seen.size
      headerRowIndex = i
    }
  }

  const labels = (rows[headerRowIndex] ?? []).map(cellText)
  let mergedLabelRows = 0
  let dataRowIndex = rows.length

  const walkEnd = Math.min(rows.length, headerRowIndex + 1 + MAX_HEADER_WALK)
  for (let j = headerRowIndex + 1; j < walkEnd; j++) {
    const row = rows[j] ?? []
    if (isBlankRow(row) || isNumberingRow(row)) continue
    if (mergedLabelRows >= MAX_LABEL_ROWS) {
      dataRowIndex = j
      break
    }

    const trial = labels.slice()
    for (let col = 0; col < Math.max(trial.length, row.length); col++) {
      const fragment = cellText(row[col])
      if (!fragment) continue
      const existing = trial[col] ?? ''
      if (existing.includes(fragment)) continue
      trial[col] = existing ? `${existing} ${fragment}` : fragment
    }

    // A row continues the header when merging it completes a new field, or
    // when it holds nothing under the columns already resolved as data —
    // the stacked-label case where e.g. "DATE" + "OF" + "BIRTH" spans rows.
    let extendsHeader = false
    let valuesUnderResolvedColumns = false
    for (let col = 0; col < Math.max(labels.length, trial.length); col++) {
      const before = resolveColumnRole(labels[col] ?? '')
      const after = resolveColumnRole(trial[col] ?? '')
      if (after.kind === 'field' && (before.kind !== 'field' || before.field !== after.field)) {
        extendsHeader = true
      }
      if (before.kind !== 'ignored' && col < row.length && cellText(row[col]) !== '') {
        valuesUnderResolvedColumns = true
      }
    }

    if (!extendsHeader && valuesUnderResolvedColumns) {
      dataRowIndex = j
      break
    }

    labels.splice(0, labels.length, ...trial)
    mergedLabelRows += 1
  }

  const fieldColumns = new Map<ImportColumn, number>()
  const addressPrefixColumns: number[] = []
  const addressSuffixColumns: number[] = []
  labels.forEach((label, col) => {
    const role = resolveColumnRole(label)
    if (role.kind === 'field') {
      if (!fieldColumns.has(role.field)) fieldColumns.set(role.field, col)
    } else if (role.kind === 'address-part') {
      const bucket = role.position === 'prefix' ? addressPrefixColumns : addressSuffixColumns
      bucket.push(col)
    }
  })

  return {
    headerRowIndex,
    dataRowIndex,
    fieldColumns,
    addressPrefixColumns,
    addressSuffixColumns,
    headerLabels: labels,
    missingRequired: REQUIRED_IMPORT_COLUMNS.filter((col) => !fieldColumns.has(col)),
  }
}

/**
 * Extract the raw import fields for one data row using a column plan.
 *
 * When house-number / sitio-purok fragment columns were detected they are
 * folded into street_address in Philippine address order:
 * "6, Albay St., Purok 2". Files without such fragments keep the street
 * column byte-for-byte.
 */
export function buildRawRecordFromRow(
  row: string[],
  plan: ImportColumnPlan,
): Record<string, string> {
  const raw: Record<string, string> = {}
  for (const col of IMPORT_COLUMNS) {
    const idx = plan.fieldColumns.get(col)
    if (idx !== undefined && idx < row.length) raw[col] = row[idx]
  }

  const hasAddressParts =
    plan.addressPrefixColumns.length > 0 || plan.addressSuffixColumns.length > 0
  if (hasAddressParts) {
    const streetIdx = plan.fieldColumns.get('street_address')
    const composed = [
      ...plan.addressPrefixColumns,
      ...(streetIdx !== undefined ? [streetIdx] : []),
      ...plan.addressSuffixColumns,
    ]
      .map((col) => cellText(row[col]))
      .filter(Boolean)
      .join(', ')
    if (composed) raw.street_address = composed
  }

  return raw
}
