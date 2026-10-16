import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getEnvConfig } from '../../env.config'

function getAdminSupabaseConfig() {
  const config = getEnvConfig()

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      `Supabase ${config.name} environment variables are missing. Set the appropriate environment variables for ${config.name} environment.`,
    )
  }

  return { 
    url: config.supabaseUrl, 
    serviceRoleKey: config.supabaseServiceRoleKey
  }
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