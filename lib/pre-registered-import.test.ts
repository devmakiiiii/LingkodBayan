/**
 * Unit tests for the pre-registered residents import parsers.
 *
 * Covers format detection, Excel cell coercion, and end-to-end Excel reading
 * (a workbook is built in memory with exceljs, then read back through the
 * parser).
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/pre-registered-import.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'

import {
  IMPORT_COLUMNS,
  REQUIRED_IMPORT_COLUMNS,
  buildPreRegisteredImportRecord,
  excelCellValueToString,
  importRowSchema,
  parseExcelToRows,
  resolveImportFormat,
} from './pre-registered-import.ts'

describe('resolveImportFormat', () => {
  it('detects csv files (case-insensitive, trims whitespace)', () => {
    assert.equal(resolveImportFormat('residents.csv'), 'csv')
    assert.equal(resolveImportFormat('RESIDENTS.CSV'), 'csv')
    assert.equal(resolveImportFormat('  residents.csv  '), 'csv')
  })

  it('detects xlsx and xlsm workbooks', () => {
    assert.equal(resolveImportFormat('residents.xlsx'), 'xlsx')
    assert.equal(resolveImportFormat('Residents.XLSX'), 'xlsx')
    assert.equal(resolveImportFormat('residents.xlsm'), 'xlsx')
  })

  it('flags unsupported / legacy formats', () => {
    assert.equal(resolveImportFormat('residents.xls'), 'unsupported')
    assert.equal(resolveImportFormat('residents.txt'), 'unsupported')
    assert.equal(resolveImportFormat(''), 'unsupported')
  })
})

describe('excelCellValueToString', () => {
  it('returns empty string for nullish and error cells', () => {
    assert.equal(excelCellValueToString(null), '')
    assert.equal(excelCellValueToString(undefined), '')
    assert.equal(excelCellValueToString({ error: '#N/A' }), '')
  })

  it('stringifies primitives', () => {
    assert.equal(excelCellValueToString('Barretto'), 'Barretto')
    assert.equal(excelCellValueToString(123456789012), '123456789012')
    assert.equal(excelCellValueToString(true), 'true')
  })

  it('formats date cells as YYYY-MM-DD using their UTC calendar date', () => {
    assert.equal(excelCellValueToString(new Date(Date.UTC(1985, 2, 15))), '1985-03-15')
    assert.equal(excelCellValueToString(new Date(Date.UTC(1990, 0, 2))), '1990-01-02')
  })

  it('unwraps rich text, hyperlink and formula values', () => {
    assert.equal(
      excelCellValueToString({ richText: [{ text: 'Dela ' }, { text: 'Cruz' }] }),
      'Dela Cruz',
    )
    assert.equal(
      excelCellValueToString({ text: 'Philsys', hyperlink: 'https://example.com' }),
      'Philsys',
    )
    assert.equal(excelCellValueToString({ formula: 'A1', result: 42 }), '42')
  })
})

describe('parseExcelToRows', () => {
  async function buildWorkbookBuffer(): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Residents')
    sheet.addRow([
      'first_name', 'last_name', 'middle_name', 'date_of_birth', 'email',
      'phone', 'street_address', 'barangay', 'city_municipality',
      'province', 'postal_code', 'national_id', 'id_type',
    ])
    sheet.addRow([
      'Juan', 'Dela Cruz', 'Santos', new Date(Date.UTC(1985, 2, 15)), 'juan@example.com',
      '09171234567', '1234 Ilo-Ilo Street, Purok 1', 'Barretto', 'Olongapo City',
      'Zambales', '2200', 123456789012, 'philsys',
    ])
    // A blank spacer row must be ignored by the parser.
    sheet.addRow([])
    sheet.addRow([
      'Maria', 'Santos', 'Reyes', new Date(Date.UTC(1990, 0, 2)), 'maria@example.com',
      '09179876543', '', 'Barretto', 'Olongapo City',
      'Zambales', '2200', '987654321098', 'philsys',
    ])
    return new Uint8Array(await workbook.xlsx.writeBuffer())
  }

  it('reads the first worksheet into a header + data matrix', async () => {
    const buffer = await buildWorkbookBuffer()
    const rows = await parseExcelToRows(buffer)

    assert.equal(rows.length, 3)
    assert.deepEqual(rows[0], [
      'first_name', 'last_name', 'middle_name', 'date_of_birth', 'email',
      'phone', 'street_address', 'barangay', 'city_municipality',
      'province', 'postal_code', 'national_id', 'id_type',
    ])
    assert.equal(rows[1][0], 'Juan')
    assert.equal(rows[1][3], '1985-03-15')
    assert.equal(rows[1][11], '123456789012')
    assert.equal(rows[1][12], 'philsys')
    assert.equal(rows[2][0], 'Maria')
    assert.equal(rows[2][3], '1990-01-02')
  })

  it('accepts an ArrayBuffer input', async () => {
    const buffer = await buildWorkbookBuffer()
    const copy = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const rows = await parseExcelToRows(copy)
    assert.equal(rows[0][0], 'first_name')
    assert.equal(rows[1][1], 'Dela Cruz')
  })
})

describe('import column requirements', () => {
  it('exposes the documented columns in order', () => {
    assert.equal(IMPORT_COLUMNS[0], 'first_name')
    assert.equal(IMPORT_COLUMNS[1], 'last_name')
    assert.equal(IMPORT_COLUMNS[IMPORT_COLUMNS.length - 1], 'id_type')
  })

  it('does not require an email column (household records have none)', () => {
    assert.deepEqual([...REQUIRED_IMPORT_COLUMNS], ['first_name', 'last_name'])
    assert.equal((REQUIRED_IMPORT_COLUMNS as readonly string[]).includes('email'), false)
  })
})

// Mirrors the shape of a real barangay household listing: name, DOB and address
// but no email / phone / national ID. This is the exact case that used to import
// "0 residents" because a blank email failed validation.
const householdRow = {
  first_name: 'Ronilo',
  last_name: 'Eugenio',
  middle_name: 'Borcione',
  date_of_birth: '1965-07-18',
  email: '',
  phone: '',
  street_address: '29 Dagupan',
  barangay: 'Barretto',
  city_municipality: 'Olongapo City',
  province: 'Zambales',
  postal_code: '2200',
  national_id: '',
  id_type: '',
}

describe('importRowSchema', () => {
  it('accepts a household row with a blank email', () => {
    assert.equal(importRowSchema.safeParse(householdRow).success, true)
  })

  it('accepts a row that omits the email key entirely', () => {
    const withoutEmail: Record<string, unknown> = { ...householdRow }
    delete withoutEmail.email
    assert.equal(importRowSchema.safeParse(withoutEmail).success, true)
  })

  it('still rejects a malformed email', () => {
    const result = importRowSchema.safeParse({ ...householdRow, email: 'not-an-email' })
    if (result.success) throw new Error('expected a malformed email to be rejected')
    assert.ok(result.error.errors.some((e) => e.message === 'Invalid email format'))
  })

  it('requires first and last name', () => {
    const result = importRowSchema.safeParse({ last_name: 'Eugenio' })
    if (result.success) throw new Error('expected the missing first name to be rejected')
    assert.ok(result.error.errors.some((e) => e.message === 'First name is required'))
  })

  it('accepts a known id_type and rejects an unknown one', () => {
    assert.equal(importRowSchema.safeParse({ ...householdRow, id_type: 'philsys' }).success, true)
    assert.equal(importRowSchema.safeParse({ ...householdRow, id_type: 'library_card' }).success, false)
  })
})

describe('buildPreRegisteredImportRecord', () => {
  const meta = { source: 'csv_upload', importBatchId: 'import_test' }

  it('builds a record with a null email for a household row', () => {
    const result = buildPreRegisteredImportRecord(householdRow, meta)
    if (!result.ok) throw new Error(`expected success, got: ${result.errors.join('; ')}`)
    assert.equal(result.record.first_name, 'Ronilo')
    assert.equal(result.record.last_name, 'Eugenio')
    assert.equal(result.record.email, null)
    assert.equal(result.record.phone, null)
    assert.equal(result.record.barangay, 'Barretto')
    assert.equal(result.record.city_municipality, 'Olongapo City')
    assert.equal(result.record.province, 'Zambales')
    assert.equal(result.record.date_of_birth, '1965-07-18')
    assert.equal(result.record.source, 'csv_upload')
    assert.equal(result.record.import_batch_id, 'import_test')
  })

  it('lowercases a supplied email and reduces the phone to digits', () => {
    const result = buildPreRegisteredImportRecord(
      { ...householdRow, email: 'Ronilo.Eugenio@Example.COM', phone: '+63 917 123 4567' },
      meta,
    )
    if (!result.ok) throw new Error(`expected success, got: ${result.errors.join('; ')}`)
    assert.equal(result.record.email, 'ronilo.eugenio@example.com')
    assert.equal(result.record.phone, '639171234567')
  })

  it('rejects a row for a barangay outside the service area', () => {
    const result = buildPreRegisteredImportRecord({ ...householdRow, barangay: 'Kalaklan' }, meta)
    if (result.ok) throw new Error('expected an out-of-area barangay to be rejected')
    assert.ok(result.errors[0].includes('only serves Barangay Barretto'))
  })

  it('defaults a blank barangay to the system barangay', () => {
    const result = buildPreRegisteredImportRecord({ ...householdRow, barangay: '' }, meta)
    if (!result.ok) throw new Error(`expected success, got: ${result.errors.join('; ')}`)
    assert.equal(result.record.barangay, 'Barretto')
  })

  it('reports schema errors instead of throwing', () => {
    const result = buildPreRegisteredImportRecord({ last_name: 'Eugenio' }, meta)
    if (result.ok) throw new Error('expected a missing first name to be rejected')
    assert.ok(result.errors.includes('First name is required'))
  })
})
