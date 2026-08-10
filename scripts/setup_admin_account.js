#!/usr/bin/env node

/**
 * Idempotent admin account configurator for LingkodBayan.
 *
 * Uses the Supabase Service Role Key to:
 *   1. Create or update the Auth user with the configured email/password and
 *      `role: 'admin'` set in both `user_metadata` and `app_metadata`
 *      (user_metadata.role is read by middleware.ts; app_metadata.role is read
 *      by the is_admin_user() SQL function as a fallback).
 *   2. Upsert a matching row in the `admin_users` table so RLS admin policies
 *      (which are guarded by is_admin_user(auth.uid())) grant access.
 *
 * Credentials are read from environment variables so secrets are never committed.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@lingkodbayan.com \
 *   ADMIN_PASSWORD='LingkodBayan123!@#' \
 *   node scripts/setup_admin_account.js
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local for standalone Node runs (Next.js normally does this for the app).
function loadDotenvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    // Don't override values already present in the real environment.
    if (process.env[key] === undefined) process.env[key] = value
  }
}
loadDotenvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'Admin'
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'Bayan'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('ERROR: Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function adminMetadata() {
  return {
    first_name: ADMIN_FIRST_NAME,
    last_name: ADMIN_LAST_NAME,
    role: 'admin',
  }
}

async function findUserByEmail(email) {
  let page = 1
  const perPage = 100
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })
    if (error) throw error

    const match = data.users.find((u) => u.email === email)
    if (match) return match

    if (data.users.length < perPage) break
    page += 1
  }
  return null
}

async function main() {
  console.log(`\n=== Configuring admin account for ${ADMIN_EMAIL} ===\n`)

  const existing = await findUserByEmail(ADMIN_EMAIL)
  let userId

  if (existing) {
    console.log('Found existing auth user:', existing.id)

    const { data: updated, error: updateError } =
      await supabase.auth.admin.updateUserById(existing.id, {
        password: ADMIN_PASSWORD,
        user_metadata: adminMetadata(),
        app_metadata: { role: 'admin' },
      })

    if (updateError) throw updateError

    userId = updated.user.id
    console.log('Updated auth user: password and admin metadata set.')
  } else {
    console.log('No existing auth user found. Creating new user...')

    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: adminMetadata(),
        app_metadata: { role: 'admin' },
      })

    if (createError) throw createError

    userId = created.user.id
    console.log('Created auth user:', userId)
  }

  console.log('\nSyncing admin_users table row...')
  const { data: adminRow, error: upsertError } = await supabase
    .from('admin_users')
    .upsert(
      {
        user_id: userId,
        email: ADMIN_EMAIL,
        first_name: ADMIN_FIRST_NAME,
        last_name: ADMIN_LAST_NAME,
        role: 'admin',
        is_active: true,
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (upsertError) throw upsertError

  console.log('admin_users row upserted:', JSON.stringify(adminRow, null, 2))

  // Verification
  console.log('\n=== Verification ===')
  const { data: authUser, error: getErr } =
    await supabase.auth.admin.getUserById(userId)
  if (getErr) throw getErr

  console.log('Auth user_metadata.role:', authUser.user.user_metadata?.role)
  console.log('Auth app_metadata.role   :', authUser.user.app_metadata?.role)

  const { data: isAdminRow, error: fnErr } = await supabase.rpc(
    'is_admin_user',
    { target_user_id: userId },
  )
  if (fnErr) throw fnErr
  console.log('is_admin_user()', isAdminRow)

  console.log(`\nAdmin account for ${ADMIN_EMAIL} is now configured.`)
  console.log('Login at /auth/login and you will be redirected to /admin/dashboard.\n')
}

main().catch((err) => {
  console.error('\nERROR:', err?.message || err)
  process.exit(1)
})
