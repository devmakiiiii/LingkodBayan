#!/usr/bin/env node
// Seeds the TESTING database with a verified citizen, an admin account, and
// sample requests. Requires TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY.
//
// Usage:
//   TEST_SUPABASE_URL=... TEST_SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-test-database.js
import { createClient } from '@supabase/supabase-js'

async function ensureAuthUser(supabase, { email, password, firstName, lastName, appMetadata = {} }) {
  // Look the user up first so re-running the seeder is idempotent.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    throw new Error(`Failed to list auth users: ${listError.message}`)
  }

  const existing = list.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
  if (existing) {
    console.log(`   ↻ Auth user already exists: ${email}`)
    return existing
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
    app_metadata: appMetadata,
  })

  if (error) {
    throw new Error(`Failed to create auth user ${email}: ${error.message}`)
  }

  console.log(`   + Created auth user: ${email}`)
  return data.user
}

async function seedTestDatabase() {
  const supabaseUrl = process.env.TEST_SUPABASE_URL
  const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Test database configuration missing')
    console.log('Set TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('🌱 Seeding test database...')

  // 1. Auth users (service role bypasses RLS and email confirmation).
  const citizenAuth = await ensureAuthUser(supabase, {
    email: 'citizen@test.com',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'Citizen',
  })

  const adminAuth = await ensureAuthUser(supabase, {
    email: 'admin@test.com',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'Admin',
    // app_metadata is the only role source the app trusts (see lib/roles.ts).
    appMetadata: { role: 'admin' },
  })

  // 2. Resident profile (user_id must be a real auth.users UUID).
  const { data: existingResidents, error: residentLookupError } = await supabase
    .from('residents')
    .select('id')
    .eq('user_id', citizenAuth.id)
    .limit(1)

  if (residentLookupError) {
    console.error('❌ Error looking up residents:', residentLookupError)
    process.exit(1)
  }

  let residentId = existingResidents?.[0]?.id
  if (residentId) {
    console.log('   ↻ Resident profile already exists: citizen@test.com')
  } else {
    const { data: inserted, error: residentError } = await supabase
      .from('residents')
      .insert({
        user_id: citizenAuth.id,
        first_name: 'Test',
        last_name: 'Citizen',
        email: 'citizen@test.com',
        barangay: 'Barretto',
        phone: '+63 123 456 7890',
        address: 'Test Address, Olongapo City',
        verification_status: 'verified',
        date_of_birth: '1990-01-01',
      })
      .select('id')
      .single()

    if (residentError) {
      console.error('❌ Error seeding resident:', residentError)
      process.exit(1)
    }

    residentId = inserted.id
    console.log('   + Created resident profile: citizen@test.com (verified)')
  }

  // 3. Admin profile.
  const { data: existingAdmins, error: adminLookupError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', adminAuth.id)
    .limit(1)

  if (adminLookupError) {
    console.error('❌ Error looking up admin users:', adminLookupError)
    process.exit(1)
  }

  if (existingAdmins?.length) {
    console.log('   ↻ Admin profile already exists: admin@test.com')
  } else {
    const { error: adminError } = await supabase.from('admin_users').insert({
      user_id: adminAuth.id,
      first_name: 'Test',
      last_name: 'Admin',
      email: 'admin@test.com',
      role: 'admin',
      is_active: true,
    })

    if (adminError) {
      console.error('❌ Error seeding admin user:', adminError)
      process.exit(1)
    }

    console.log('   + Created admin profile: admin@test.com')
  }

  // 4. Sample requests (skipped if this resident already has any).
  const { data: existingRequests, error: requestLookupError } = await supabase
    .from('requests')
    .select('id')
    .eq('resident_id', residentId)
    .limit(1)

  if (requestLookupError) {
    console.error('❌ Error looking up requests:', requestLookupError)
    process.exit(1)
  }

  if (existingRequests?.length) {
    console.log('   ↻ Sample requests already exist; skipping')
  } else {
    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .insert([
        {
          resident_id: residentId,
          request_type: 'cleanliness',
          title: 'Garbage Collection Service',
          description: 'Need regular garbage collection in our street',
          category: 'sanitation',
          status: 'completed',
          priority: 'normal',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          resident_id: residentId,
          request_type: 'lighting',
          title: 'Street Light Installation',
          description: 'Install street lights on Main Street',
          category: 'infrastructure',
          status: 'in_progress',
          priority: 'high',
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ])
      .select('id')

    if (requestsError) {
      console.error('❌ Error seeding requests:', requestsError)
      process.exit(1)
    }

    console.log(`   + Seeded ${requests?.length || 0} sample requests`)
  }

  console.log('🎉 Test database seeding complete!')
}

seedTestDatabase().catch((error) => {
  console.error('❌ Seeding failed:', error.message ?? error)
  process.exit(1)
})