#!/usr/bin/env node
/**
 * Local diagnostic (read-mostly, self-cleaning): confirms migration 35's
 * `trg_prune_verification_ocr_jobs` trigger is actually live on the project.
 *
 *   node scripts/_check_prune_trigger.mjs
 *
 * PostgREST cannot introspect pg_trigger, so this verifies behaviour instead:
 * insert a row whose expires_at is already in the past and check whether it
 * survives. If the trigger fires the row is gone before the read-back; if the
 * trigger is missing the row is still there, and this script deletes it again
 * so no test data is left behind either way.
 *
 * Uses the service role key, which bypasses the RLS on the table (the table is
 * intentionally unreachable to anon/authenticated).
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^"|"$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const rest = (p, init = {}) =>
  fetch(`${url}/rest/v1/${p}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  })

// ---------------------------------------------------------------------------
// Check 1: is trg_prune_verification_ocr_jobs actually live?
// ---------------------------------------------------------------------------
// PostgREST cannot introspect pg_trigger, so verify behaviour instead: insert a
// row whose expires_at is already past the prune threshold and check whether it
// survives. Cleans up after itself either way.
const residents = await rest('residents?select=user_id&limit=1').then((r) => r.json())
const userId = residents?.[0]?.user_id
if (!userId) {
  console.error('No resident row with a user_id; cannot build a FK-valid test row.')
  process.exit(1)
}

const jobId = crypto.randomUUID()
const expiredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

const insert = await rest('verification_ocr_jobs', {
  method: 'POST',
  body: JSON.stringify({
    id: jobId,
    user_id: userId,
    status: 'completed',
    result: { pruneTriggerProbe: true },
    expires_at: expiredAt,
  }),
})

if (!insert.ok) {
  console.error('Insert failed:', insert.status, await insert.text())
  process.exit(1)
}

const rows = await rest(`verification_ocr_jobs?id=eq.${jobId}&select=id`).then((r) => r.json())
const survived = Array.isArray(rows) && rows.length > 0

console.log('=== Check 1: prune trigger ===')
if (survived) {
  await rest(`verification_ocr_jobs?id=eq.${jobId}`, { method: 'DELETE' })
  console.log('FAIL  expired row SURVIVED -> trigger is not firing.')
  console.log('      Re-apply scripts/35_durable_ocr_jobs.sql (test row cleaned up).')
} else {
  console.log('PASS  expired row was reaped -> trg_prune_verification_ocr_jobs is live.')
}

// ---------------------------------------------------------------------------
// Check 2: does user_metadata carry the claim middleware.ts reads?
// ---------------------------------------------------------------------------
console.log('\n=== Check 2: verification_status claim in user_metadata ===')
const usersRes = await fetch(`${url}/auth/v1/admin/users?per_page=100`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
})
const { users = [] } = usersRes.ok ? await usersRes.json() : { users: [] }

const VERIFIED = ['auto_verified', 'id_verified']
let admins = 0
let missingClaim = 0
let mismatched = 0

for (const u of users) {
  const md = u.user_metadata ?? {}
  const role = md.role ?? 'citizen'
  const claim = md.verification_status
  if (role === 'admin' || role === 'super_admin') admins++
  if (role === 'citizen' && claim === undefined) missingClaim++

  const outcome =
    claim === undefined
      ? 'pass-through (no claim; middleware will not redirect)'
      : VERIFIED.includes(claim)
        ? 'verified'
        : 'redirected to /citizen/verify-id'

  console.log(`  ${(u.email ?? '').padEnd(28)} role=${role.padEnd(11)} claim=${String(claim).padEnd(13)} ${outcome}`)
}

console.log(`\n  admins: ${admins}`)
console.log(`  citizens missing the claim: ${missingClaim}  (migration 37 backfills these)`)

// Cross-check the claim against the authoritative residents row the RLS gate reads.
const resRows = await rest(
  'residents?select=user_id,first_name,verification_status',
).then((r) => r.json())

console.log('\n  residents.verification_status (authoritative, drives the RLS gate):')
for (const r of resRows ?? []) {
  const claim = users.find((u) => u.id === r.user_id)?.user_metadata?.verification_status
  if (claim !== undefined && claim !== r.verification_status) mismatched++
  console.log(
    `    ${(r.first_name ?? '').padEnd(15)} db=${String(r.verification_status).padEnd(14)} claim=${String(claim).padEnd(14)}${
      claim !== undefined && claim !== r.verification_status ? '  <-- DRIFT' : ''
    }`,
  )
}

console.log(
  `\n  claim/db drift: ${mismatched}  (middleware disagrees with the RLS gate)` +
    (mismatched ? ' -> stale claim, re-run migration 37 or re-verify the resident.' : ''),
)

