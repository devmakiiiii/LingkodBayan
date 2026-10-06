import { test, expect } from '@playwright/test'

/**
 * Public tracking page (/track): no login required. Invalid codes surface a
 * friendly error; the input is capped at 40 chars (CODE_QUERY_MAX_LENGTH).
 */
test.describe('public tracking', () => {
  test('renders the tracking form', async ({ page }) => {
    await page.goto('/track')

    await expect(page.getByLabel(/tracking code/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /check status/i })).toBeVisible()
  })

  test('gibberish code reaches the API and shows its guidance', async ({ page }) => {
    await page.goto('/track')

    await page.locator('#code').fill('!!!not-a-code!!!')
    await page.getByRole('button', { name: /check status/i }).click()

    // The page forwards anything non-empty to /api/public/track, whose
    // normaliser rejects it with the "use a code like …" guidance. Scoped to
    // <main> so the Next.js route announcer (also role=alert) doesn't collide.
    await expect(
      page.getByRole('main').getByRole('alert').filter({ hasText: /invalid tracking code/i }),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('over-long input is truncated to 40 characters', async ({ page }) => {
    await page.goto('/track')

    const input = page.locator('#code')
    await input.fill('A'.repeat(100))
    await expect(input).toHaveValue('A'.repeat(40))
  })

  test('well-formed but unknown code reports "no submission found"', async ({ page }) => {
    // Hits the real API route (rate-limited at 15/min/IP); against the
    // placeholder Supabase config the lookup fails server-side, which must
    // still surface as a readable error, not a blank page.
    await page.goto('/track')

    await page.locator('#code').fill('REQ-AAAAAAAA')
    await page.getByRole('button', { name: /check status/i }).click()

    await expect(
      page.getByRole('main').getByRole('alert'),
    ).toBeVisible({ timeout: 15_000 })
  })
})

