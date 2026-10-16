import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getEnvConfig } from '../../env.config'

function getSupabaseConfig() {
  const config = getEnvConfig()

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      `Supabase ${config.name} environment variables are missing. Set the appropriate environment variables for ${config.name} environment.`,
    )
  }

  return { url: config.supabaseUrl, anonKey: config.supabaseAnonKey }
}

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseConfig()

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  )
}
