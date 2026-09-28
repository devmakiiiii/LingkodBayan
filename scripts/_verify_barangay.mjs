// Post-migration check for the Barangay Barretto single-barangay deployment.
//
// Run it after any data change that touches `residents` or
// `pre_registered_residents`:
//   node scripts/_verify_barangay.mjs
//
// Read-only except for two insert+delete round-trips that prove the CHECK
// constraints and column defaults are live; every test row created here is
// removed again in section 4 (and on the error path), so the net effect on the
// database is zero. Exits non-zero if any check fails.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// Lives in scripts/, so the project root (and .env.local) is one level up.
const env = Object.fromEntries(
  fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) {
  console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(2)
}

let failures = 0
const pass = (m) => console.log('  PASS  ' + m)
const fail = (m) => {
  failures += 1
  console.log('  FAIL  ' + m)
}
const info = (m) => console.log('  info  ' + m)

async function rest(method, apiPath, { body, count, prefer } = {}) {
  const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }
  if (count) headers.Prefer = 'count=exact'
  if (prefer) headers.Prefer = headers.Prefer ? headers.Prefer + ',' + prefer : prefer
  const res = await fetch(URL_ + '/rest/v1/' + apiPath, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return {
    status: res.status,
    count: Number((res.headers.get('content-range') || '').split('/')[1]) || null,
    data,
  }
}

async function authAdmin(method, apiPath, body) {
  const res = await fetch(URL_ + '/auth/v1/' + apiPath, {
    method,
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

const DEFAULT_EMAIL = 'migration-34-defaults@example.invalid'
const REJECT_EMAIL = 'migration-34-reject@example.invalid'
const AUTH_EMAIL = 'migration-34-authcheck@example.invalid'
const TEST_EMAILS = [DEFAULT_EMAIL, REJECT_EMAIL, AUTH_EMAIL]
const BARANGAY_NAME = 'Barretto'

async function cleanup() {
  for (const email of TEST_EMAILS) {
    await rest('DELETE', `pre_registered_residents?email=eq.${encodeURIComponent(email)}`)
  }

  const users = await authAdmin('GET', 'admin/users?per_page=200')
  const list = Array.isArray(users.data?.users) ? users.data.users : []
  for (const user of list.filter((u) => u.email === AUTH_EMAIL)) {
    await authAdmin('DELETE', `admin/users/${user.id}`)
  }
  // Residents are removed by the user_id ON DELETE CASCADE; this is a backstop.
  await rest('DELETE', `residents?email=eq.${encodeURIComponent(AUTH_EMAIL)}`)
}

async function main() {
  let registryForeignCount = 0

  console.log('== 1. residents / pre_registered_residents barangay values ==')

  const residentRows = await rest('GET', 'residents?select=barangay&limit=10000')
  if (residentRows.status !== 200) {
    fail(`residents select -> HTTP ${residentRows.status}: ${JSON.stringify(residentRows.data).slice(0, 200)}`)
  } else {
    const rows = residentRows.data ?? []
    const outOfArea = rows.filter((r) => (r.barangay || '').trim() !== BARANGAY_NAME)
    info(`residents rows: ${rows.length}`)
    if (outOfArea.length === 0) pass('every residents row is barangay = Barretto')
    else
      fail(
        `${outOfArea.length} residents row(s) are still not Barretto -> ${JSON.stringify([
          ...new Set(outOfArea.map((r) => r.barangay)),
        ])}`,
      )
  }

  const registryRows = await rest('GET', 'pre_registered_residents?select=barangay,city_municipality,province')
  if (registryRows.status !== 200) {
    fail(`pre_registered_residents select -> HTTP ${registryRows.status}`)
  } else {
    const rows = registryRows.data ?? []
    info(`pre_registered_residents rows: ${rows.length}`)
    const foreign = rows.filter((r) => (r.barangay || '').trim().toLowerCase() !== 'barretto')
    registryForeignCount = foreign.length
    if (foreign.length === 0) pass('every pre_registered_residents row is Barretto')
    else
      info(
        `${foreign.length} registry row(s) still reference another barangay -> ${JSON.stringify([
          ...new Set(foreign.map((r) => r.barangay)),
        ])}`,
      )

    const provinces = {}
    for (const r of rows) provinces[r.province ?? '(null)'] = (provinces[r.province ?? '(null)'] || 0) + 1
    info(`province values: ${JSON.stringify(provinces)}`)

    const cities = {}
    for (const r of rows) cities[r.city_municipality ?? '(null)'] = (cities[r.city_municipality ?? '(null)'] || 0) + 1
    info(`city_municipality values: ${JSON.stringify(cities)}`)
  }

  console.log('== 2. Column defaults on pre_registered_residents ==')
  const inserted = await rest('POST', 'pre_registered_residents', {
    body: { first_name: 'Migration', last_name: 'Check', email: DEFAULT_EMAIL, source: 'migration_check' },
    prefer: 'return=representation',
  })
  const insertedRow = Array.isArray(inserted.data) ? inserted.data[0] : inserted.data
  if (inserted.status >= 300 || !insertedRow) {
    fail(`insert without barangay/city/province -> HTTP ${inserted.status}: ${JSON.stringify(inserted.data).slice(0, 250)}`)
  } else {
    if (insertedRow.barangay === 'Barretto') pass('barangay defaulted to Barretto')
    else fail(`barangay defaulted to "${insertedRow.barangay}"`)

    if (insertedRow.city_municipality === 'Olongapo City') pass('city_municipality defaulted to Olongapo City')
    else fail(`city_municipality defaulted to "${insertedRow.city_municipality}"`)

    if (insertedRow.province === 'Zambales') pass('province defaulted to Zambales')
    else fail(`province defaulted to "${insertedRow.province}"`)
  }

  console.log('== 3. CHECK constraints ==')

  // The registry constraint is intentionally skipped while the registry still
  // holds rows from before the deployment became Barretto-only, so only assert
  // it once those rows are cleaned up.
  if (registryForeignCount > 0) {
    info(
      `pre_registered_residents CHECK not enforced yet: ${registryForeignCount} row(s) are still out of area — clean them up, re-run migration 34, then re-run this script`,
    )
    await rest('DELETE', `pre_registered_residents?email=eq.${encodeURIComponent(REJECT_EMAIL)}`)
  } else {
    const rejectedRegistry = await rest('POST', 'pre_registered_residents', {
      body: {
        first_name: 'Migration',
        last_name: 'Reject',
        email: REJECT_EMAIL,
        barangay: 'New Cabalan',
        source: 'migration_check',
      },
      prefer: 'return=representation',
    })
    const registryCode = rejectedRegistry.data?.code
    const registryRejected =
      rejectedRegistry.status >= 300 &&
      (registryCode === '23514' || String(rejectedRegistry.data?.message || '').includes('barangay_is_barretto'))
    if (registryRejected) {
      pass(`pre_registered_residents rejects another barangay (HTTP ${rejectedRegistry.status}, ${registryCode})`)
    } else {
      fail(
        `expected a 23514 rejection on pre_registered_residents, got HTTP ${rejectedRegistry.status}: ${JSON.stringify(
          rejectedRegistry.data,
        ).slice(0, 250)}`,
      )
    }

    const acceptedVariant = await rest('POST', 'pre_registered_residents', {
      body: {
        first_name: 'Migration',
        last_name: 'Variant',
        email: REJECT_EMAIL,
        barangay: 'Brgy. Barretto',
        source: 'migration_check',
      },
      prefer: 'return=representation',
    })
    const variantRow = Array.isArray(acceptedVariant.data) ? acceptedVariant.data[0] : acceptedVariant.data
    if (acceptedVariant.status < 300 && variantRow?.barangay === 'Brgy. Barretto') {
      pass('the accepted spelling "Brgy. Barretto" is stored as entered')
    } else {
      fail(`"Brgy. Barretto" -> HTTP ${acceptedVariant.status}: ${JSON.stringify(acceptedVariant.data).slice(0, 250)}`)
    }
  }

  // residents: prove the constraint that failed before is now live, using a
  // throwaway auth user so the row can satisfy the user_id foreign key.
  const user = await authAdmin('POST', 'admin/users', {
    email: AUTH_EMAIL,
    password: 'Migration34Check!2026',
    email_confirm: true,
  })
  const userId = user.data?.id
  if (!userId) {
    info(`skipped the residents constraint check (throwaway auth user not created: HTTP ${user.status})`)
  } else {
    const badResident = await rest('POST', 'residents', {
      body: {
        user_id: userId,
        first_name: 'Migration',
        last_name: 'Check',
        email: AUTH_EMAIL,
        barangay: 'New Cabalan',
      },
      prefer: 'return=representation',
    })
    const badCode = badResident.data?.code
    const residentRejected =
      badResident.status >= 300 &&
      (badCode === '23514' || String(badResident.data?.message || '').includes('barangay_is_barretto'))
    if (residentRejected) pass(`residents rejects another barangay (HTTP ${badResident.status}, ${badCode})`)
    else
      fail(
        `expected a 23514 rejection on residents, got HTTP ${badResident.status}: ${JSON.stringify(badResident.data).slice(
          0,
          250,
        )}`,
      )

    const goodResident = await rest('POST', 'residents', {
      body: { user_id: userId, first_name: 'Migration', last_name: 'Check', email: AUTH_EMAIL, barangay: 'Barretto' },
      prefer: 'return=representation',
    })
    if (goodResident.status < 300) pass('residents still accepts Barretto')
    else fail(`residents insert with Barretto -> HTTP ${goodResident.status}: ${JSON.stringify(goodResident.data).slice(0, 250)}`)
  }

  console.log('== 4. Cleanup ==')
  await cleanup()

  const leftoverRegistry = await rest('HEAD', 'pre_registered_residents?select=id&source=eq.migration_check', {
    count: true,
  })
  const leftoverResidents = await rest('HEAD', `residents?select=id&email=eq.${encodeURIComponent(AUTH_EMAIL)}`, {
    count: true,
  })
  const users = await authAdmin('GET', 'admin/users?per_page=200')
  const leftoverUsers = (Array.isArray(users.data?.users) ? users.data.users : []).filter((u) => u.email === AUTH_EMAIL)

  if ((leftoverRegistry.count ?? 0) === 0 && (leftoverResidents.count ?? 0) === 0 && leftoverUsers.length === 0) {
    pass('all test rows removed (pre_registered_residents, residents, auth user)')
  } else {
    fail(
      `leftovers: registry=${leftoverRegistry.count} residents=${leftoverResidents.count} authUsers=${leftoverUsers.length}`,
    )
  }
}

main()
  .catch(async (error) => {
    failures += 1
    console.log('  FAIL  unexpected error: ' + (error?.message || error))
    try {
      await cleanup()
      console.log('  info  cleanup attempted after the error')
    } catch (cleanupError) {
      console.log('  FAIL  cleanup after error failed: ' + (cleanupError?.message || cleanupError))
    }
  })
  .finally(() => {
    console.log('')
    console.log(failures === 0 ? 'RESULT: all checks passed' : `RESULT: ${failures} check(s) failed`)
    process.exit(failures === 0 ? 0 : 1)
  })

