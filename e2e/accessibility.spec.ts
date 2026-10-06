import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * WCAG 2.1 AA audit (axe-core). One spec per public surface; runs against the
 * same dev server as the rest of the E2E suite. Violations of serious or
 * critical impact fail the build.
 */
async function scan(page: import('@playwright/test').Page, path: string) {
  await page.goto(path)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations
}

test.describe('accessibility (WCAG 2.1 AA)', () => {
  test('landing page has no serious or critical violations', async ({ page }) => {
    const violations = await scan(page, '/')
    const serious = violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(
      serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  })

  test('login page has no serious or critical violations', async ({ page }) => {
    const violations = await scan(page, '/auth/login')
    const serious = violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(
      serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  })

  test('tracking page has no serious or critical violations', async ({ page }) => {
    const violations = await scan(page, '/track')
    const serious = violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(
      serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  })

  test('services page has no serious or critical violations', async ({ page }) => {
    const violations = await scan(page, '/services')
    const serious = violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(
      serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  })
})
