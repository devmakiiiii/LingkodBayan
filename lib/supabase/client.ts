import { createBrowserClient } from '@supabase/ssr'
import { getEnvConfig } from '../../env.config'

export function hasSupabaseConfig() {
  const config = getEnvConfig()
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}

function getSupabaseConfig() {
  const config = getEnvConfig()

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      `Supabase ${config.name} environment variables are missing. Set the appropriate environment variables for ${config.name} environment.`,
    )
  }

  return { url: config.supabaseUrl, anonKey: config.supabaseAnonKey }
}

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!browserClient) {
    const { url, anonKey } = getSupabaseConfig()
    browserClient = createBrowserClient(url, anonKey)
  }

  return browserClient
}
