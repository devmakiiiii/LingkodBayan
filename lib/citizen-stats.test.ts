/**
 * Unit tests for the citizen dashboard counting helpers.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/citizen-stats.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  countComplaintsByStatus,
  countRequestsByStatus,
  sortByCreatedAtDesc,
} from './citizen-stats.ts'
import {
  getComplaintStatusClassName,
  getComplaintStatusLabel,
  isOpenComplaintStatus,
} from './complaint-status.ts'

describe('countRequestsByStatus', () => {
  it('counts empty and missing input as zero', () => {
    const empty = countRequestsByStatus([])
    assert.equal(empty.total, 0)
    assert.equal(empty.inProgress, 0)

    const missing = countRequestsByStatus(undefined)
    assert.equal(missing.total, 0)
    assert.equal(missing.approved, 0)
  })

  it('buckets canonical statuses so the totals reconcile', () => {
    const counts = countRequestsByStatus([
      { status: 'pending' },
      { status: 'pending' },
      { status: 'processing' },
      { status: 'approved' },
      { status: 'rejected' },
    ])

    assert.equal(counts.total, 5)
    assert.equal(counts.pending, 2)
    assert.equal(counts.processing, 1)
    assert.equal(counts.approved, 1)
    assert.equal(counts.rejected, 1)
    assert.equal(
      counts.pending + counts.processing + counts.approved + counts.rejected,
      counts.total,
    )
    assert.equal(counts.inProgress, 3)
  })

  it('folds legacy and mixed-case aliases onto canonical statuses', () => {
    const counts = countRequestsByStatus([
      { status: 'in-progress' },
      { status: 'IN_PROGRESS' },
      { status: 'resolved' },
      { status: null },
    ])

    assert.equal(counts.processing, 2)
    assert.equal(counts.approved, 1)
    // Unknown / missing values fall back to the machine's initial state.
    assert.equal(counts.pending, 1)
    assert.equal(counts.total, 4)
  })
})

describe('countComplaintsByStatus', () => {
  it('counts under_investigation rather than a literal in-progress status', () => {
    const counts = countComplaintsByStatus([
      { status: 'open' },
      { status: 'under_investigation' },
      { status: 'under_review' },
      { status: 'in-progress' },
      { status: 'resolved' },
      { status: 'dismissed' },
    ])

    assert.equal(counts.total, 6)
    assert.equal(counts.open, 1)
    assert.equal(counts.underReview, 3)
    assert.equal(counts.resolved, 1)
    assert.equal(counts.dismissed, 1)
    assert.equal(
      counts.open + counts.underReview + counts.resolved + counts.dismissed,
      counts.total,
    )
    assert.equal(counts.inProgress, 4)
  })

  it('accepts empty input', () => {
    const counts = countComplaintsByStatus([])
    assert.equal(counts.total, 0)
    assert.equal(counts.underReview, 0)
    assert.equal(counts.inProgress, 0)
  })
})

describe('sortByCreatedAtDesc', () => {
  it('sorts newest first without mutating the source array', () => {
    const rows = [
      { id: 'old', created_at: '2026-01-01T00:00:00.000Z' },
      { id: 'new', created_at: '2026-03-01T00:00:00.000Z' },
      { id: 'mid', created_at: '2026-02-01T00:00:00.000Z' },
    ]

    const sorted = sortByCreatedAtDesc(rows)

    assert.deepEqual(
      sorted.map((row) => row.id),
      ['new', 'mid', 'old'],
    )
    assert.deepEqual(
      rows.map((row) => row.id),
      ['old', 'new', 'mid'],
    )
  })

  it('handles empty and undefined input', () => {
    assert.deepEqual(sortByCreatedAtDesc(undefined), [])
    assert.deepEqual(sortByCreatedAtDesc([]), [])
  })
})

describe('complaint status presentation', () => {
  it('labels canonical and legacy complaint statuses consistently', () => {
    assert.equal(getComplaintStatusLabel('open'), 'Open')
    assert.equal(getComplaintStatusLabel('under_investigation'), 'Under Review')
    assert.equal(getComplaintStatusLabel('in-progress'), 'Under Review')
    assert.equal(getComplaintStatusLabel('under_review'), 'Under Review')
    assert.equal(getComplaintStatusLabel('resolved'), 'Resolved')
    assert.equal(getComplaintStatusLabel('dismissed'), 'Dismissed')
    assert.equal(getComplaintStatusLabel('rejected'), 'Dismissed')
  })

  it('returns a badge class for every canonical status', () => {
    for (const status of ['open', 'under_investigation', 'resolved', 'dismissed'] as const) {
      assert.match(getComplaintStatusClassName(status), /border-/)
    }
  })

  it('treats open and under review complaints as still actionable', () => {
    assert.equal(isOpenComplaintStatus('open'), true)
    assert.equal(isOpenComplaintStatus('under_investigation'), true)
    assert.equal(isOpenComplaintStatus('in-progress'), true)
    assert.equal(isOpenComplaintStatus('resolved'), false)
    assert.equal(isOpenComplaintStatus('dismissed'), false)
  })
})
