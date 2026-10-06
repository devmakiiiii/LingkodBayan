import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E suite for LingkodBayan.
 *
 * These tests target flows that unit tests cannot cover: routing guards,
 * form validation, and the public no-login surfaces. Authenticated flows
 * (dashboard, request filing) need a seeded Supabase project, so they are
 * gated behind E2E_SEED_URL / E2E_TEST_USER / E2E_TEST_PASSWORD and skipped
 * in plain CI. Everything else runs against `next dev` with the placeholder
 * Supabase config from CI (public pages render without a backend).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
  },
})
