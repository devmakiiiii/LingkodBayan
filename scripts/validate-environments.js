#!/usr/bin/env node
// Validates that every configured Supabase environment is reachable.
// Reads .env.local (if present) plus process env. Environments without
// credentials are skipped; at least one must be configured.
//
// Usage: node scripts/validate-environments.js
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Minimal .env loader — avoids adding a dotenv dependency. Existing
// process.env values win, matching dotenv's override:false behaviour.
function loadEnvFile(filename) {
  const envPath = path.join(__dirname, '..', filename)
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (key in process.env) continue
    const value = rawValue.replace(/^['"]|['"]$/g, '')
    if (value) process.env[key] = value
  }
}

async function validateEnvironment(envName, config) {
  console.log(`\n🔍 Validating ${envName} environment...`)

  try {
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Test basic connectivity against a table every schema has.
    const { error } = await supabase.from('residents').select('id').limit(1)

    if (error) {
      console.log(`❌ ${envName} validation failed:`, error.message)
      return false
    }

    console.log(`✅ ${envName} environment is accessible`)
    return true
  } catch (error) {
    console.log(`❌ ${envName} validation failed:`, error.message)
    return false
  }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env.test')
  loadEnvFile('.env.production')

  const environments = [
    {
      name: 'Development',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    {
      name: 'Testing',
      supabaseUrl: process.env.TEST_SUPABASE_URL,
      supabaseAnonKey: process.env.TEST_SUPABASE_ANON_KEY,
    },
    {
      name: 'Production',
      supabaseUrl: process.env.PRODUCTION_SUPABASE_URL,
      supabaseAnonKey: process.env.PRODUCTION_SUPABASE_ANON_KEY,
    },
  ].filter((env) => env.supabaseUrl && env.supabaseAnonKey)

  if (environments.length === 0) {
    console.error('❌ No environment credentials found.')
    console.log(
      'Configure NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local), ' +
        'TEST_SUPABASE_URL/TEST_SUPABASE_ANON_KEY, or ' +
        'PRODUCTION_SUPABASE_URL/PRODUCTION_SUPABASE_ANON_KEY.',
    )
    process.exit(1)
  }

  const results = await Promise.allSettled(
    environments.map((env) => validateEnvironment(env.name, env)),
  )

  const passed = results.filter(
    (result) => result.status === 'fulfilled' && result.value,
  ).length
  const total = environments.length

  console.log(`\n📊 Validation Summary: ${passed}/${total} environments passed`)

  if (passed === total) {
    console.log('🎉 All environments validated successfully!')
  } else {
    console.log('⚠️  Some environments failed validation')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Validation run failed:', error.message ?? error)
  process.exit(1)
})