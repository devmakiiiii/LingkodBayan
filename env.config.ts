import { createClient } from '@supabase/supabase-js'

interface EnvConfig {
  name: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  postgresUrl?: string;
}

const baseConfig = {
  development: {
    name: 'development',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev-key',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-service-key',
  },
  test: {
    name: 'test',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  production: {
    name: 'production',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
} as const;

export function getEnvConfig(env: string = process.env.NODE_ENV || 'development'): EnvConfig {
  return baseConfig[env as keyof typeof baseConfig] || baseConfig.development;
}

export const createBrowserClient = () => {
  const config = getEnvConfig()
  return createClient(config.supabaseUrl, config.supabaseAnonKey)
}

export const createServerClient = () => {
  const config = getEnvConfig()
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey)
}

export const createAdminClient = () => {
  const config = getEnvConfig()
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    global: {
      headers: {
        'x-client-info': 'lingkodbayan/1.0.0'
      }
    }
  })
}