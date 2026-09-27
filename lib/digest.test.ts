/**
 * Unit tests for the weekly backlog digest helpers.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/digest.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { buildBacklogDigest, type DigestInput } from './digest.ts'

/** A fixed "now" so ages are deterministic. */
const NOW = new Date('2026-03-10T12:00:00.000Z')

const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

const emptyInput = (): DigestInput => ({ requests: [], complaints: [] })

describe('buildBacklogDigest', () => {
  it('flags items older than 7 days but not exactly 7 days (boundary)', () => {
    const input: DigestInput = {
      requests: [
        { id: 'req-exact', status: 'pending', created_at: daysAgo(7) },
        { id: 'req-aging', status: 'processing', created_at: daysAgo(8) },
      ],
      complaints: [
        { id: 'cmp-exact', status: 'open', created_at: daysAgo(7) },
        { id: 'cmp-aging', status: 'under_investigation', created_at: daysAgo(10) },
      ],
    }

    const digest = buildBacklogDigest(input, NOW)

    assert.deepEqual(digest.agingRequests.map((row) => row.id), ['req-aging'])
    assert.equal(digest.agingRequests[0].ageDays, 8)
    assert.deepEqual(digest.agingComplaints.map((row) => row.id), ['cmp-aging'])
    assert.equal(digest.agingComplaints[0].ageDays, 10)
  })

  it('excludes terminal statuses from aging and open totals', () => {
    const input: DigestInput = {
      requests: [
        { id: 'req-done', status: 'approved', created_at: daysAgo(30) },
        { id: 'req-denied', status: 'rejected', created_at: daysAgo(30) },
        { id: 'req-old-alias', status: 'resolved', created_at: daysAgo(30) },
        { id: 'req-live', status: 'processing', created_at: daysAgo(20) },
      ],
      complaints: [
        { id: 'cmp-resolved', status: 'resolved', created_at: daysAgo(30) },
        { id: 'cmp-dismissed', status: 'dismissed', created_at: daysAgo(30) },
        { id: 'cmp-live', status: 'open', created_at: daysAgo(20) },
      ],
    }

    const digest = buildBacklogDigest(input, NOW)

    assert.deepEqual(digest.agingRequests.map((row) => row.id), ['req-live'])
    assert.deepEqual(digest.agingComplaints.map((row) => row.id), ['cmp-live'])
    assert.equal(digest.totalOpenRequests, 1)
    assert.equal(digest.totalOpenComplaints, 1)
  })

  it('detects active requests with no assigned official', () => {
    const input: DigestInput = {
      requests: [
        { id: 'req-a', status: 'pending', created_at: daysAgo(1), assigned_official: null },
        { id: 'req-b', status: 'processing', created_at: daysAgo(2), assigned_official: '' },
        { id: 'req-c', status: 'pending', created_at: daysAgo(3), assigned_official: 'official-1' },
        { id: 'req-d', status: 'approved', created_at: daysAgo(1), assigned_official: null },
      ],
      complaints: [],
    }

    const digest = buildBacklogDigest(input, NOW)

    // Approved (terminal) requests are never "needs assignment".
    assert.deepEqual(digest.unassignedRequests.map((row) => row.id), ['req-b', 'req-a'])
  })

  it('sorts aging items oldest first', () => {
    const input: DigestInput = {
      requests: [],
      complaints: [
        { id: 'cmp-mid', status: 'open', created_at: daysAgo(12) },
        { id: 'cmp-oldest', status: 'open', created_at: daysAgo(20) },
        { id: 'cmp-newest', status: 'open', created_at: daysAgo(9) },
      ],
    }

    const digest = buildBacklogDigest(input, NOW)

    assert.deepEqual(
      digest.agingComplaints.map((row) => row.id),
      ['cmp-oldest', 'cmp-mid', 'cmp-newest'],
    )
  })

  it('handles empty inputs and missing dates gracefully', () => {
    const empty = buildBacklogDigest(emptyInput(), NOW)
    assert.equal(empty.totalOpenRequests, 0)
    assert.equal(empty.totalOpenComplaints, 0)
    assert.deepEqual(empty.agingRequests, [])
    assert.deepEqual(empty.agingComplaints, [])
    assert.deepEqual(empty.unassignedRequests, [])
    assert.match(empty.summary, /backlog is clear/i)

    const noDates: DigestInput = {
      requests: [{ id: 'req-x', status: 'pending', created_at: null }],
      complaints: [{ id: 'cmp-x', status: 'open', created_at: null }],
    }
    const digest = buildBacklogDigest(noDates, NOW)
    assert.deepEqual(digest.agingRequests, [])
    assert.deepEqual(digest.agingComplaints, [])
    assert.equal(digest.totalOpenRequests + digest.totalOpenComplaints, 2)
  })

  it('builds a one-sentence human-readable summary', () => {
    const busy: DigestInput = {
      requests: [
        { id: 'req-1', status: 'pending', created_at: daysAgo(9), assigned_official: null },
        { id: 'req-2', status: 'processing', created_at: daysAgo(2), assigned_official: 'official-1' },
      ],
      complaints: [{ id: 'cmp-1', status: 'open', created_at: daysAgo(15) }],
    }
    const digest = buildBacklogDigest(busy, NOW)
    assert.equal(digest.summary, "This week's backlog has 3 open items and 2 aging beyond 7 days and 1 awaiting assignment.")
    assert.equal((digest.summary.match(/\./g) ?? []).length, 1)
  })
})
