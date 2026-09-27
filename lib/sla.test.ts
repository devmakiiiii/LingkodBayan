/**
 * Unit tests for the SLA due-date helpers.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/sla.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_SLA_BUSINESS_DAYS,
  computeSlaDueDate,
  getSlaBusinessDays,
  getSlaStatus,
  slaPolicy,
} from './sla.ts'

/** Fixed "now" so tests are deterministic: Wed, 18 Jun 2025 10:00:00 local. */
const NOW = new Date(2025, 5, 18, 10, 0, 0)

function at(daysFromNow: number, hours = 10): string {
  const date = new Date(NOW)
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(hours, 0, 0, 0)

  return date.toString()
}

describe('SLA policy', () => {
  it('maps each known request type to its target business days', () => {
    assert.equal(slaPolicy['barangay-clearance'], 3)
    assert.equal(slaPolicy['certificate-residency'], 2)
    assert.equal(slaPolicy['business-permit'], 7)
    assert.equal(slaPolicy['good-moral'], 3)
    assert.equal(slaPolicy.indigency, 2)
  })

  it('falls back to the default for unknown or missing types', () => {
    assert.equal(getSlaBusinessDays('street-naming'), DEFAULT_SLA_BUSINESS_DAYS)
    assert.equal(getSlaBusinessDays(null), DEFAULT_SLA_BUSINESS_DAYS)
    assert.equal(getSlaBusinessDays(undefined), DEFAULT_SLA_BUSINESS_DAYS)
  })
})

describe('computeSlaDueDate', () => {
  it('skips weekends when counting business days', () => {
    // Wed 18 Jun + 2 business days -> Fri 20 Jun.
    const wednesday = new Date(2025, 5, 18, 10, 0, 0)
    assert.equal(computeSlaDueDate(wednesday, 2).toDateString(), new Date(2025, 5, 20).toDateString())

    // Thu 19 Jun + 2 business days crosses the weekend -> Mon 23 Jun.
    const thursday = new Date(2025, 5, 19, 10, 0, 0)
    assert.equal(computeSlaDueDate(thursday, 2).toDateString(), new Date(2025, 5, 23).toDateString())

    // Fri 20 Jun + 1 business day -> Mon 23 Jun.
    const friday = new Date(2025, 5, 20, 10, 0, 0)
    assert.equal(computeSlaDueDate(friday, 1).toDateString(), new Date(2025, 5, 23).toDateString())
  })

  it('starts counting on the next business day when created on a weekend', () => {
    // Sat 21 Jun (counting starts Mon 23) + 1 business day -> Tue 24 Jun.
    const saturday = new Date(2025, 5, 21, 10, 0, 0)
    assert.equal(computeSlaDueDate(saturday, 1).toDateString(), new Date(2025, 5, 24).toDateString())

    // Sun 22 Jun (counting starts Mon 23) + 2 business days -> Wed 25 Jun.
    const sunday = new Date(2025, 5, 22, 10, 0, 0)
    assert.equal(computeSlaDueDate(sunday, 2).toDateString(), new Date(2025, 5, 25).toDateString())
  })

  it('accepts ISO date strings', () => {
    const iso = '2025-06-18T10:00:00'
    const fromString = computeSlaDueDate(iso, 2)
    const fromDate = computeSlaDueDate(new Date(iso), 2)

    assert.equal(fromString.toDateString(), fromDate.toDateString())
    assert.equal(fromString.toDateString(), new Date(2025, 5, 20).toDateString())
  })
})

describe('getSlaStatus', () => {
  it('reports terminal statuses as done with no overdue math', () => {
    for (const status of ['approved', 'rejected', 'resolved', 'APPROVED']) {
      const sla = getSlaStatus({ created_at: at(-30), status }, NOW)

      assert.equal(sla.tone, 'done')
      assert.equal(sla.dueDate, null)
      assert.equal(sla.daysRemaining, null)
      assert.equal(sla.label, 'Completed')
    }
  })

  it('reports non-terminal requests far from the due date as ok', () => {
    // Wed + 5 default business days -> Wed 25 Jun, ~7 days away.
    const sla = getSlaStatus({ created_at: NOW.toString(), status: 'pending' }, NOW)

    assert.equal(sla.tone, 'ok')
    assert.equal(sla.daysRemaining, 7)
    assert.equal(sla.label, 'Due in 7 days')
  })

  it('reports 0-2 days remaining as due-soon', () => {
    // Due date = end of today -> "Due today".
    const today = getSlaStatus({ created_at: at(-2, 9), status: 'processing', request_type: 'certificate-residency' }, NOW)
    assert.equal(today.tone, 'due-soon')
    assert.equal(today.label, 'Due today')

    // One business day out (created Tuesday, due Thursday) -> "Due tomorrow".
    const tomorrow = getSlaStatus({ created_at: at(-1, 9), status: 'processing', request_type: 'certificate-residency' }, NOW)
    assert.equal(tomorrow.tone, 'due-soon')
    assert.equal(tomorrow.label, 'Due tomorrow')

    // Two business days out (created today, due Friday) -> "Due in 2 days".
    const twoDays = getSlaStatus({ created_at: NOW.toString(), status: 'processing', request_type: 'certificate-residency' }, NOW)
    assert.equal(twoDays.tone, 'due-soon')
    assert.equal(twoDays.label, 'Due in 2 days')
  })

  it('reports past-due requests as overdue', () => {
    const sla = getSlaStatus({ created_at: at(-14, 9), status: 'pending' }, NOW)

    assert.equal(sla.tone, 'overdue')
    assert.equal(sla.daysRemaining! < 0, true)
    assert.match(sla.label, /^Overdue by \d+ days?$/)
  })

  it('uses the request-type policy when computing the due date', () => {
    const sla = getSlaStatus({ created_at: NOW.toString(), status: 'pending', request_type: 'certificate-residency' }, NOW)

    assert.equal(sla.dueDate!.toDateString(), new Date(2025, 5, 20).toDateString())
    assert.equal(sla.label, 'Due in 2 days')
  })

  it('handles missing created_at gracefully', () => {
    const sla = getSlaStatus({ created_at: null, status: 'pending' }, NOW)

    assert.equal(sla.dueDate, null)
    assert.equal(sla.daysRemaining, null)
    assert.equal(sla.tone, 'ok')
  })
})