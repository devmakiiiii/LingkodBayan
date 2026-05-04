import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function getAdminSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase admin environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Project Settings, then redeploy.',
    )
  }

  return { url, serviceRoleKey }
}

export function createAdminClient() {
  const { url, serviceRoleKey } = getAdminSupabaseConfig()

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}