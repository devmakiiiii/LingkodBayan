import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

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

const EXPECTED_COLUMNS = [
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

const REQUIRED_COLUMNS = ['first_name', 'last_name', 'email', 'barangay'] as const

const ALLOWED_ID_TYPES = [
  'philsys',
  'drivers_license',
  'passport',
  'voter',
  'sss',
  'tin',
  'umid',
] as const

const csvRowSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  middle_name: z.string().optional().or(z.literal('')),
  date_of_birth: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((val) => {
      if (!val) return true
      const date = new Date(val)
      if (isNaN(date.getTime())) return false
      return date <= new Date()
    }, 'Invalid date format (expected YYYY-MM-DD)'),
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  phone: z.string().optional().or(z.literal('')),
  street_address: z.string().optional().or(z.literal('')),
  barangay: z.string().min(1, 'Barangay is required'),
  city_municipality: z.string().optional().or(z.literal('')),
  province: z.string().optional().or(z.literal('')),
  postal_code: z.string().optional().or(z.literal('')),
  national_id: z.string().optional().or(z.literal('')),
  id_type: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((val) => {
      if (!val) return true
      return (ALLOWED_ID_TYPES as readonly string[]).includes(val)
    }, 'Invalid ID type'),
})

type CsvRow = z.infer<typeof csvRowSchema>

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
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

  const isAdmin = !!user && (
    user.user_metadata?.role === 'admin' ||
    user.user_metadata?.role === 'super_admin' ||
    user.app_metadata?.role === 'admin' ||
    user.app_metadata?.role === 'super_admin'
  )

  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('pre_registered_residents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/pre-registered-residents] Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch pre-registered residents.' }, { status: 500 })
  }

  return NextResponse.json({ residents: data || [] })
}

export async function POST(request: NextRequest) {
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

  const isAdmin = !!user && (
    user.user_metadata?.role === 'admin' ||
    user.user_metadata?.role === 'super_admin' ||
    user.app_metadata?.role === 'admin' ||
    user.app_metadata?.role === 'super_admin'
  )

  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const adminClient = createAdminClient()

  try {
    const contentType = request.headers.get('content-type') || ''
    const batchId = `csv_${Date.now()}`

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
      }

      const csvText = await file.text()
      const rows = parseCsv(csvText)

      if (rows.length < 2) {
        return NextResponse.json({ error: 'CSV file must contain a header row and at least one data row.' }, { status: 400 })
      }

      const headers = rows[0].map((h) => h.trim().toLowerCase())
      const columnMap = new Map<string, number>()
      headers.forEach((h, idx) => columnMap.set(h, idx))

      const missingRequired = REQUIRED_COLUMNS.filter((col) => !columnMap.has(col))
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
        for (const col of EXPECTED_COLUMNS) {
          const idx = columnMap.get(col)
          if (idx !== undefined && idx < row.length) {
            rawRecord[col] = row[idx]
          }
        }

        const result = csvRowSchema.safeParse(rawRecord)

        if (!result.success) {
          failedRows.push({
            row: i + 1,
            errors: result.error.errors.map((e) => e.message),
          })
          continue
        }

        const record = result.data

        const phone = record.phone ? normalizePhone(record.phone) : null

        validRecords.push({
          first_name: record.first_name,
          last_name: record.last_name,
          middle_name: record.middle_name || null,
          date_of_birth: record.date_of_birth || null,
          email: record.email,
          phone,
          street_address: record.street_address || null,
          barangay: record.barangay,
          city_municipality: record.city_municipality || null,
          province: record.province || 'Metro Manila',
          postal_code: record.postal_code || null,
          national_id: record.national_id || null,
          id_type: record.id_type || null,
          source: 'csv_upload',
          import_batch_id: batchId,
        })
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
        province: r.province || 'Metro Manila',
        postal_code: r.postalCode || r.postal_code || '',
        national_id: r.nationalId || r.national_id || '',
        id_type: r.idType || r.id_type || '',
      }

      const result = csvRowSchema.safeParse(rawRecord)

      if (!result.success) {
        failedRows.push({
          row: i + 1,
          errors: result.error.errors.map((e) => e.message),
        })
        continue
      }

      const record = result.data
      const phone = record.phone ? normalizePhone(record.phone) : null

      validRecords.push({
        first_name: record.first_name,
        last_name: record.last_name,
        middle_name: record.middle_name || null,
        date_of_birth: record.date_of_birth || null,
        email: record.email,
        phone,
        street_address: record.street_address || null,
        barangay: record.barangay,
        city_municipality: record.city_municipality || null,
        province: record.province || 'Metro Manila',
        postal_code: record.postal_code || null,
        national_id: record.national_id || null,
        id_type: record.id_type || null,
        source: r.source || 'manual',
        import_batch_id: batchId,
      })
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
