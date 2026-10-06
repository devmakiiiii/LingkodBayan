import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * WCAG 2.1 AA audit (axe-core). One spec per public surface; runs against the
 * same dev server as the rest of the E2E suite. Violations of serious or
 * critical impact fail the build.
 *
 * The authenticated citizen-dashboard scan is gated behind the same seed
 * variables as e2e/citizen-flow.spec.ts (E2E_SEED_URL + E2E_TEST_USER +
 * E2E_TEST_PASSWORD) because the dashboard renders meaningful content only
 * for a signed-in user with a resident profile.
 */
type Violations = Awaited<ReturnType<typeof scan>>

async function scan(page: import('@playwright/test').Page, path: string) {
  await page.goto(path)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations
}

function seriousOf(violations: Violations) {
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

function assertNoSerious(violations: Violations) {
  expect(
    seriousOf(violations).map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([])
}

/** Sign in via the login form and wait for the citizen dashboard. */
async function signInAsSeededCitizen(page: import('@playwright/test').Page) {
  await page.goto('/auth/login')
  await page.getByLabel(/email/i).fill(process.env.E2E_TEST_USER!)
  await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/citizen\/dashboard/, { timeout: 20_000 })
}

const hasSeed = Boolean(
  process.env.E2E_SEED_URL && process.env.E2E_TEST_USER && process.env.E2E_TEST_PASSWORD,
)

test.describe('accessibility (WCAG 2.1 AA)', () => {
  test('landing page has no serious or critical violations', async ({ page }) => {
    assertNoSerious(await scan(page, '/'))
  })

  test('login page has no serious or critical violations', async ({ page }) => {
    assertNoSerious(await scan(page, '/auth/login'))
  })

  test('tracking page has no serious or critical violations', async ({ page }) => {
    assertNoSerious(await scan(page, '/track'))
  })

  test('services page has no serious or critical violations', async ({ page }) => {
    assertNoSerious(await scan(page, '/services'))
  })

  test('citizen dashboard has no serious or critical violations', async ({ page }) => {
    test.skip(!hasSeed, 'needs E2E_SEED_URL + E2E_TEST_USER + E2E_TEST_PASSWORD')
    await signInAsSeededCitizen(page)
    assertNoSerious(await scan(page, '/citizen/dashboard'))
  })
})
