#!/usr/bin/env node
/**
 * Local diagnostic: compares the live Supabase project against the tables and
 * columns this repo's code reads, using PostgREST's schema spec.
 *
 *   node scripts/_check_schema.mjs      # run from the repository root
 *
 * The `expected` map below is a snapshot of what the app queries; if a table
 * shows "MISSING -> ...", the migrations in scripts/ have not been applied to
 * that project yet (run `node scripts/migrate.js` and execute the output in the
 * Supabase SQL Editor).
 */
import fs from 'fs'
import path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^"|"$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
// Reading the PostgREST schema spec needs a key with introspection access; the
// service role key is used when present, otherwise fall back to the anon key.
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
})

console.log('spec status:', res.status)
const spec = await res.json()
console.log('available tables:', Object.keys(spec.definitions ?? {}).sort().join(', '))
console.log('available rpcs:', Object.keys(spec.paths ?? {}).filter((p) => p.startsWith('/rpc/')).join(', '))

// Columns the app actually reads/writes per table (grep-derived).
const expected = {
  complaint_messages: [
    'id',
    'complaint_id',
    'recipient_user_id',
    'sender_id',
    'message',
    'message_type',
    'is_read',
    'created_at',
    'updated_at',
  ],
  complaints: [
    'id',
    'resident_id',
    'title',
    'category',
    'status',
    'created_at',
    'tracking_number',
    'evidence_url',
    'priority_level',
    'assigned_official_id',
    'admin_notes',
    'archived_at',
  ],
  requests: ['id', 'resident_id', 'title', 'category', 'status', 'created_at', 'request_type'],
  announcements: [
    'id',
    'title',
    'category',
    'created_at',
    'excerpt',
    'is_published',
    'image_url',
    'published_at',
    'expires_at',
    'pinned',
  ],
  residents: ['id', 'user_id', 'verification_status', 'verification_confidence', 'date_of_birth'],
}

for (const [table, cols] of Object.entries(expected)) {
  const def = spec.definitions?.[table]
  if (!def) {
    console.log(`\n${table}: TABLE MISSING`)
    continue
  }
  const live = new Set(Object.keys(def.properties))
  const missing = cols.filter((c) => !live.has(c))
  console.log(`\n${table}: ${missing.length ? 'MISSING -> ' + missing.join(', ') : 'OK'}`)
  console.log(`  live columns: ${[...live].sort().join(', ')}`)
}

// PostgREST marks NOT NULL columns as `required` and reports defaults in the
// column metadata. A NOT NULL legacy column that the app never writes and that
// has no default rejects every insert, which no amount of added columns fixes.
const notWrittenByApp = {
  complaint_messages: ['sender_type'],
  complaints: ['issue_type'],
  audit_logs: ['created_at'],
  pre_registered_residents: ['source'],
  admin_users: ['role'],
  officials: ['status'],
  designations: ['priority_order', 'badge_color'],
}

console.log('\nLegacy NOT NULL columns the app never writes:')
for (const [table, cols] of Object.entries(notWrittenByApp)) {
  const def = spec.definitions?.[table]
  if (!def) continue
  for (const col of cols) {
    const isNotNull = (def.required ?? []).includes(col)
    const withDefault = def.properties?.[col]?.default !== undefined
    console.log(
      `  ${table}.${col}: ${isNotNull && !withDefault ? 'BLOCKS INSERTS' : 'ok (has default or nullable)'}`,
    )
  }
}

// Row counts, so an empty project can be repaired simply by re-running the
// migrations instead of reconciling existing data.
console.log('\nRow counts:')
for (const t of Object.keys(spec.definitions ?? {}).sort()) {
  const r = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' },
  })
  console.log(`  ${t}: ${r.headers.get('content-range') ?? r.status}`)
}
