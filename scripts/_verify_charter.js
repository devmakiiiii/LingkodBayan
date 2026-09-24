// Temporary post-migration verification for migrations 22-23 (Charter 2025).
// Read-only checks against PostgREST, except one insert+delete round-trip on
// `feedback` that proves the status-history trigger works (net-zero change).
const fs = require('fs')
const path = require('path')

const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('missing env'); process.exit(2) }

let failures = 0
const pass = (msg) => console.log('  PASS  ' + msg)
const fail = (msg) => { failures++; console.log('  FAIL  ' + msg) }

async function rest(method, apiPath, { body, count, prefer } = {}) {
  const headers = {
    apikey: KEY,
    Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json',
  }
  if (count) headers.Prefer = 'count=exact'
  if (prefer) headers.Prefer = (headers.Prefer ? headers.Prefer + ',' : '') + prefer
  const res = await fetch(encodeURI(URL_ + '/rest/v1/' + apiPath), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, count: Number((res.headers.get('content-range') || '').split('/')[1]) || null, data }
}

async function checkTable(name) {
  const sel = name === 'system_settings' ? 'setting_key' : 'id'
  const r = await rest('HEAD', `${name}?select=${sel}`, { count: true })
  if (r.status === 200) pass(`table ${name} exists (${r.count} rows)`)
  else fail(`table ${name} -> HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`)
  return r
}

async function main() {
  console.log('== 1. Tables from migration 22 ==')
  for (const t of ['offices', 'service_steps', 'feedback', 'feedback_status_history', 'request_status_history', 'complaint_status_history', 'service_category_requirements', 'service_categories', 'system_settings']) {
    await checkTable(t)
  }

  console.log('== 2. Offices seed (expect 10, charter section 20) ==')
  const offices = await rest('GET', 'offices?select=office_key,name,phone,is_active&order=sort_order')
  if (offices.status === 200 && offices.data.length === 10) pass('offices = 10 rows')
  else fail(`offices expected 10, got ${offices.status === 200 ? offices.data.length : 'HTTP ' + offices.status}`)
  const bbfru = (offices.data || []).find((o) => o.office_key === 'bbfru')
  const bpat = (offices.data || []).find((o) => o.office_key === 'bpat')
  if (bbfru && bbfru.phone === '0946-214-2438') pass('bbfru hotline 0946-214-2438')
  else fail(`bbfru hotline wrong: ${bbfru && bbfru.phone}`)
  if (bpat && bpat.phone === '0938-949-5840') pass('bpat hotline 0938-949-5840')
  else fail(`bpat hotline wrong: ${bpat && bpat.phone}`)

  console.log('== 3. Charter columns on service_categories (proves ALTERs ran) ==')
  const cols = await rest('GET', 'service_categories?select=slug,office_key,classification,fee_type,fee_amount_min,fee_amount_max,fee_description,processing_time_text,responsible_personnel,charter_section,directory_category,transaction_types,who_may_avail&limit=3')
  if (cols.status === 200) pass('all 13 charter columns readable')
  else fail(`charter columns -> HTTP ${cols.status}: ${JSON.stringify(cols.data).slice(0, 300)}`)

  const svcs = await rest('GET', 'service_categories?select=slug,office_key,fee_type,fee_amount_min,fee_amount_max,processing_time_text&office_key=not.is.null&order=slug')
  if (svcs.status === 200 && svcs.data.length >= 9) pass(`${svcs.data.length} services carry office_key (charter seed present)`)
  else fail(`charter services with office_key: ${svcs.status === 200 ? svcs.data.length : svcs.status}`)
  const clearance = (svcs.data || []).find((s) => s.slug === 'record-clearance')
  if (clearance && clearance.fee_type === 'range' && clearance.fee_amount_min === 50 && clearance.fee_amount_max === 60) pass('record-clearance fee range 50-60 (2a intact)')
  else fail(`record-clearance fee wrong: ${JSON.stringify(clearance)}`)

  console.log('== 4. Service steps seed (5 insert blocks; joined per service) ==')
  const steps = await rest('GET', 'service_steps?select=step_number,actor,service_categories(slug)&limit=500')
  if (steps.status !== 200) fail(`service_steps query -> HTTP ${steps.status}: ${JSON.stringify(steps.data).slice(0, 200)}`)
  else {
    const bySlug = {}
    for (const s of steps.data) {
      const slug = s.service_categories && s.service_categories.slug
      if (!slug) continue
      bySlug[slug] = (bySlug[slug] || 0) + 1
    }
    const seeded = ['lot-certification-building-renovation', 'lupon-dispute-settlement', 'cctv-footage-access', 'medical-consultation-medicine', 'immunization-for-children', 'maternal-care-prenatal-checkup', 'family-planning', 'tb-screening-treatment', 'minor-treatment-first-aid', 'emergency-response-fire-rescue', 'basic-life-support-training', 'tree-cutting-animal-rescue', 'bpat-peacekeeping-assistance', 'cdc-enrollment', 'bblc-training-programs']
    const missing = seeded.filter((sl) => !bySlug[sl])
    const extra = Object.keys(bySlug).filter((sl) => !seeded.includes(sl))
    if (missing.length === 0 && extra.length === 0 && Object.keys(bySlug).reduce((a, k) => a + bySlug[k], 0) === 98) pass(`all 15 seeded services have steps; 98 total rows match seed file exactly`)
    else fail(`steps mismatch -> missing: [${missing.join(', ')}] extra-services: [${extra.join(', ')}] total: ${Object.keys(bySlug).reduce((a, k) => a + bySlug[k], 0)}/98`)
    console.log('        per-service: ' + Object.entries(bySlug).sort().map(([k, v]) => `${k}=${v}`).join(', '))
  }

  console.log('== 5. Requirements seed ==')
  const reqs = await rest('HEAD', 'service_category_requirements?select=id', { count: true })
  if (reqs.status === 200 && reqs.count > 0) pass(`service_category_requirements = ${reqs.count} rows`)
  else fail(`requirements: HTTP ${reqs.status}, count ${reqs.count}`)

  console.log('== 6. System settings (3 charter keys) ==')
  const settings = await rest('GET', 'system_settings?select=setting_key,value&setting_key=in.(barangay_identity,service_pledge,charter_version)')
  if (settings.status === 200 && settings.data.length === 3) pass('barangay_identity, service_pledge, charter_version all present')
  else fail(`settings: HTTP ${settings.status}, got ${JSON.stringify(settings.data).slice(0, 200)}`)

  console.log('== 7. Feedback trigger round-trip (insert -> history row -> delete) ==')
  // Clean any stray row from a previous run (its history cascades on delete).
  await rest('DELETE', 'feedback?subject=eq.[VERIFY] trigger test')
  const ins = await rest('POST', 'feedback', {
    body: { subject: '[VERIFY] trigger test', message: 'post-migration verification row; safe to delete', category: 'other', is_anonymous: true },
    prefer: 'return=representation',
  })
  if (ins.status !== 201 && ins.status !== 200) {
    fail(`feedback insert -> HTTP ${ins.status}: ${JSON.stringify(ins.data).slice(0, 300)}`)
  } else {
    const fbId = ins.data && ins.data[0] && ins.data[0].id
    if (!fbId) fail('insert returned no id')
    else {
      const hist = await rest('GET', `feedback_status_history?select=status&feedback_id=eq.${fbId}`)
      if (hist.status === 200 && hist.data.length === 1 && hist.data[0].status === 'submitted') pass('trigger wrote feedback_status_history row (status=submitted)')
      else fail(`history: HTTP ${hist.status} rows=${JSON.stringify(hist.data)}`)
      const del = await rest('DELETE', `feedback?id=eq.${fbId}`)
      const check = await rest('GET', `feedback?id=eq.${fbId}`)
      const histCheck = await rest('GET', `feedback_status_history?feedback_id=eq.${fbId}`)
      if (del.status === 204 && check.data.length === 0 && histCheck.data.length === 0) pass('test row deleted (history cascade-clean)')
      else fail(`cleanup incomplete: del=${del.status} fb=${check.data.length} hist=${histCheck.data.length}`)
    }
  }

  console.log('== 8. Existing history tables have expected shape (0-row reads) ==')
  for (const t of ['request_status_history', 'complaint_status_history']) {
    const r = await rest('GET', t + '?select=id&limit=1')
    if (r.status === 200) pass(`${t} readable`)
    else fail(`${t} -> HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`)
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(2) })

