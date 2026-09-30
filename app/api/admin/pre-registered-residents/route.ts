import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyRequest } from '@/lib/request-security'
import { logAuditAction } from '@/lib/audit-log'
import { logger } from '@/lib/logger'
import { isAdminUser } from '@/lib/roles'
import {
  IMPORT_COLUMNS,
  REQUIRED_IMPORT_COLUMNS,
  buildPreRegisteredImportRecord,
  parseExcelToRows,
  resolveImportFormat,
} from '@/lib/pre-registered-import'

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1)
  }
  return text
}

function parseCsv(csvText: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0
  const text = stripBom(csvText)

  while (i < text.length) {
    const char = text[i]

    if (char === '"') {
      if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
        currentField += '"'
        i += 2
        continue
      }
      inQuotes = !inQuotes
      i++
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i++
      }
      currentRow.push(currentField.trim())
      currentField = ''

      if (currentRow.length === 1 && currentRow[0] === '') {
        currentRow = []
        i++
        continue
      }

      rows.push(currentRow)
      currentRow = []
      i++
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
      i++
      continue
    }

    currentField += char
    i++
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
      rows.push(currentRow)
    }
  }

  return rows
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('pre_registered_residents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('[admin/pre-registered-residents] Error', error, { context: 'api/admin/pre-registered-residents' })
    return NextResponse.json({ error: error.message || 'Failed to fetch pre-registered residents.' }, { status: 500 })
  }

  return NextResponse.json({ residents: data || [] })
}

export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const adminClient = createAdminClient()

  try {
    const contentType = request.headers.get('content-type') || ''
    const batchId = `import_${Date.now()}`

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
      }

      const format = resolveImportFormat(file.name)

      if (format === 'unsupported') {
        return NextResponse.json(
          { error: 'Unsupported file type. Please upload a .csv, .xlsx, or .xlsm file.' },
          { status: 400 },
        )
      }

      let rows: string[][]
      if (format === 'xlsx') {
        try {
          rows = await parseExcelToRows(new Uint8Array(await file.arrayBuffer()))
        } catch (error) {
          logger.error('[admin/pre-registered-residents] Excel parse error', error, {
            context: 'api/admin/pre-registered-residents',
          })
          return NextResponse.json(
            { error: 'Could not read the spreadsheet. Please make sure it is a valid .xlsx file.' },
            { status: 400 },
          )
        }
      } else {
        rows = parseCsv(await file.text())
      }

      if (rows.length < 2) {
        return NextResponse.json({ error: 'File must contain a header row and at least one data row.' }, { status: 400 })
      }

      const headers = rows[0].map((h) => h.trim().toLowerCase())
      const columnMap = new Map<string, number>()
      headers.forEach((h, idx) => columnMap.set(h, idx))

      const missingRequired = REQUIRED_IMPORT_COLUMNS.filter((col) => !columnMap.has(col))
      if (missingRequired.length > 0) {
        return NextResponse.json({
          error: `Missing required columns in header: ${missingRequired.join(', ')}`,
          missingColumns: missingRequired,
        }, { status: 400 })
      }

      const failedRows: { row: number; errors: string[] }[] = []
      const validRecords: Record<string, unknown>[] = []

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (row.length === 0 || row.every((c) => c === '')) continue

        const rawRecord: Record<string, string> = {}
        for (const col of IMPORT_COLUMNS) {
          const idx = columnMap.get(col)
          if (idx !== undefined && idx < row.length) {
            rawRecord[col] = row[idx]
          }
        }

        const result = buildPreRegisteredImportRecord(rawRecord, {
          source: format === 'xlsx' ? 'xlsx_upload' : 'csv_upload',
          importBatchId: batchId,
        })

        if (!result.ok) {
          failedRows.push({ row: i + 1, errors: result.errors })
          continue
        }

        validRecords.push(result.record)
      }

      let importedCount = 0

      if (validRecords.length > 0) {
        const { error } = await adminClient
          .from('pre_registered_residents')
          .upsert(validRecords, { onConflict: 'email' })

        if (error) {
          console.error('[admin/pre-registered-residents] Upsert error:', error)
          return NextResponse.json({ error: `Failed to import: ${error.message}` }, { status: 500 })
        }

        importedCount = validRecords.length
      }

      const response: Record<string, unknown> = {
        success: true,
        imported: importedCount,
        totalProcessed: rows.length - 1,
        batchId,
      }

      if (failedRows.length > 0) {
        response.failedRows = failedRows
        response.failedCount = failedRows.length
      }

      await logAuditAction({
        adminId: user.id,
        adminEmail: user.email ?? undefined,
        action: 'residents_imported',
        resourceType: 'pre_registered_residents',
        resourceId: batchId,
        newValues: {
          imported: importedCount,
          totalProcessed: rows.length - 1,
          failedCount: failedRows.length,
        },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      })

      return NextResponse.json(response)
    }

    const body = await request.json()

    if (!Array.isArray(body.residents)) {
      return NextResponse.json({ error: 'Expected "residents" array in JSON body.' }, { status: 400 })
    }

    const failedRows: { row: number; errors: string[] }[] = []
    const validRecords: Record<string, unknown>[] = []

    for (let i = 0; i < body.residents.length; i++) {
      const r = body.residents[i]
      const rawRecord: Record<string, unknown> = {
        first_name: r.firstName || r.first_name,
        last_name: r.lastName || r.last_name,
        middle_name: r.middleName || r.middle_name || '',
        date_of_birth: r.dateOfBirth || r.date_of_birth || '',
        email: r.email,
        phone: r.phone || '',
        street_address: r.streetAddress || r.street_address || '',
        barangay: r.barangay,
        city_municipality: r.cityMunicipality || r.city_municipality || '',
        province: r.province || '',
        postal_code: r.postalCode || r.postal_code || '',
        national_id: r.nationalId || r.national_id || '',
        id_type: r.idType || r.id_type || '',
      }

      const result = buildPreRegisteredImportRecord(rawRecord, {
        source: r.source || 'manual',
        importBatchId: batchId,
      })

      if (!result.ok) {
        failedRows.push({ row: i + 1, errors: result.errors })
        continue
      }

      validRecords.push(result.record)
    }

    let importedCount = 0

    if (validRecords.length > 0) {
      const { error } = await adminClient
        .from('pre_registered_residents')
        .upsert(validRecords, { onConflict: 'email' })

      if (error) {
        console.error('[admin/pre-registered-residents] Upsert error:', error)
        return NextResponse.json({ error: `Failed to import: ${error.message}` }, { status: 500 })
      }

      importedCount = validRecords.length
    }

    const response: Record<string, unknown> = {
      success: true,
      imported: importedCount,
      totalProcessed: body.residents.length,
      batchId,
    }

    if (failedRows.length > 0) {
      response.failedRows = failedRows
      response.failedCount = failedRows.length
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    console.error('[admin/pre-registered-residents] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to import pre-registered residents.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
