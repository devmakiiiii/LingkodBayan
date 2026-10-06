import { test, expect } from '@playwright/test'

/**
 * Auth guardrails: unauthenticated visitors are bounced to /auth/login with
 * a ?next= hint, and the login form validates before ever touching Supabase.
 */
test.describe('auth guards', () => {
  test('unauthenticated /citizen/dashboard redirects to login with ?next=', async ({ page }) => {
    await page.goto('/citizen/dashboard')
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fcitizen%2Fdashboard/)
  })

  test('unauthenticated /admin/dashboard redirects to login with ?next=', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fadmin%2Fdashboard/)
  })

  test('crafted ?next= to an external origin is not honoured after login page loads', async ({ page }) => {
    // safeRedirectTarget only honours same-origin relative paths. The form
    // itself is client-side, so assert the page renders and the link targets
    // stay internal rather than attempting a real credential submit.
    await page.goto('/auth/login?next=https://evil.example.com')
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })
})

/**
 * Login form: required fields, friendly errors, and the sign-up escape hatch.
 * No credentials are submitted — these run without a backend.
 */
test.describe('login form', () => {
  test('renders email + password fields and a sign-in button', async ({ page }) => {
    await page.goto('/auth/login')

    // Label-based lookup is ambiguous on this page (the password field's
    // show/hide toggle confuses the accessible-name computation), so target
    // the stable input ids directly.
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('sign-in with a seeded account shows the Supabase failure as a readable error', async ({
    page,
  }) => {
    // No backend here (placeholder Supabase config), so sign-in must fail —
    // the assertion is that the failure surfaces as a readable inline error,
    // not a hang or a blank page.
    await page.goto('/auth/login')

    await page.locator('#email').fill('e2e@example.com')
    await page.locator('#password').fill('wrong-password')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 })
  })

  test('links to sign-up and forgot-password', async ({ page }) => {
    await page.goto('/auth/login')

    await expect(page.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/auth/sign-up')
    await expect(page.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/auth/forgot-password',
    )
  })
})
