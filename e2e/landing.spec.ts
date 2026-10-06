import { test, expect } from '@playwright/test'

/**
 * Landing page: renders the civic portal entry point and links into the
 * auth + public tracking surfaces. Runs without a backend.
 */
test.describe('landing page', () => {
  test('renders hero and links to login, sign-up, and tracking', async ({ page }) => {
    await page.goto('/')

    // The portal brands itself; the hero heading names the barangay service.
    await expect(page.getByRole('heading').first()).toBeVisible()

    await expect(page.getByRole('link', { name: /sign in|log in/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /sign up|create account|register/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /track/i }).first()).toBeVisible()
  })
})
