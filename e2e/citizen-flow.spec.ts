import { test, expect } from '@playwright/test'

/**
 * Authenticated citizen flow: sign in with a seeded account, land on the
 * citizen dashboard, and reach the request-service surface.
 *
 * Requires a seeded Supabase project:
 *   E2E_SEED_URL=https://<project>.supabase.co
 *   E2E_TEST_USER=<verified citizen email>
 *   E2E_TEST_PASSWORD=<password>
 *
 * Skipped in plain CI (placeholder Supabase config has no users).
 */
const hasSeed = Boolean(
  process.env.E2E_SEED_URL && process.env.E2E_TEST_USER && process.env.E2E_TEST_PASSWORD,
)

test.describe('authenticated citizen flow', () => {
  test.skip(!hasSeed, 'needs E2E_SEED_URL + E2E_TEST_USER + E2E_TEST_PASSWORD')

  test('sign in lands on the citizen dashboard', async ({ page }) => {
    await page.goto('/auth/login')

    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_USER!)
    await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/citizen\/dashboard/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  })

  test('dashboard links into request-service and my-requests', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_USER!)
    await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/citizen\/dashboard/, { timeout: 20_000 })

    await expect(page.getByRole('link', { name: /request.*service|new request/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /my requests|track.*request/i }).first()).toBeVisible()
  })
})
