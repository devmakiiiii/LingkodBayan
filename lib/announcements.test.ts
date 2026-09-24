/**
 * Unit tests for the announcement scheduling/visibility rules.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/announcements.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  getAnnouncementStatus,
  isAnnouncementColumnError,
  isAnnouncementVisible,
  toDateTimeLocalValue,
} from './announcements.ts'

const NOW = new Date('2026-09-25T12:00:00.000Z')

describe('getAnnouncementStatus', () => {
  it('treats an unpublished announcement as a draft', () => {
    assert.equal(getAnnouncementStatus({ is_published: false }, NOW), 'draft')
    assert.equal(getAnnouncementStatus({}, NOW), 'draft')
  })

  it('treats a published announcement with no schedule as published', () => {
    assert.equal(getAnnouncementStatus({ is_published: true }, NOW), 'published')
  })

  it('marks a future published_at as scheduled', () => {
    assert.equal(
      getAnnouncementStatus(
        { is_published: true, published_at: '2026-09-26T09:00:00.000Z' },
        NOW,
      ),
      'scheduled',
    )
  })

  it('marks a past published_at as published', () => {
    assert.equal(
      getAnnouncementStatus(
        { is_published: true, published_at: '2026-09-24T09:00:00.000Z' },
        NOW,
      ),
      'published',
    )
  })

  it('marks a past expires_at as expired', () => {
    assert.equal(
      getAnnouncementStatus(
        { is_published: true, published_at: '2026-09-20T09:00:00.000Z', expires_at: '2026-09-25T11:59:00.000Z' },
        NOW,
      ),
      'expired',
    )
  })

  it('keeps an announcement published until expires_at is reached', () => {
    assert.equal(
      getAnnouncementStatus(
        { is_published: true, published_at: '2026-09-20T09:00:00.000Z', expires_at: '2026-09-25T12:01:00.000Z' },
        NOW,
      ),
      'published',
    )
  })

  it('reports expiry ahead of scheduling so a stale notice never looks live', () => {
    assert.equal(
      getAnnouncementStatus(
        { is_published: true, published_at: '2026-09-30T09:00:00.000Z', expires_at: '2026-09-24T09:00:00.000Z' },
        NOW,
      ),
      'expired',
    )
  })
})

describe('isAnnouncementVisible', () => {
  it('only exposes published announcements to residents', () => {
    assert.equal(isAnnouncementVisible({ is_published: true, published_at: '2026-09-20T09:00:00.000Z' }, NOW), true)
    assert.equal(isAnnouncementVisible({ is_published: false }, NOW), false)
    assert.equal(isAnnouncementVisible({ is_published: true, published_at: '2026-10-01T09:00:00.000Z' }, NOW), false)
    assert.equal(isAnnouncementVisible({ is_published: true, expires_at: '2026-09-01T09:00:00.000Z' }, NOW), false)
  })
})

describe('isAnnouncementColumnError', () => {
  it('detects missing optional columns', () => {
    assert.equal(
      isAnnouncementColumnError({ message: "column announcements.pinned does not exist" }),
      true,
    )
    assert.equal(
      isAnnouncementColumnError({ message: "column announcements.expires_at does not exist" }),
      true,
    )
  })

  it('ignores unrelated errors', () => {
    assert.equal(isAnnouncementColumnError({ message: 'permission denied for relation' }), false)
    assert.equal(isAnnouncementColumnError(null), false)
  })
})

describe('toDateTimeLocalValue', () => {
  it('round-trips an ISO timestamp into a datetime-local value', () => {
    const iso = '2026-09-25T09:30:00.000Z'
    const local = toDateTimeLocalValue(iso)
    assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    // Re-parsing the local value must land on the same instant.
    assert.equal(new Date(local).getTime(), new Date(iso).getTime())
  })

  it('returns an empty string for missing or invalid input', () => {
    assert.equal(toDateTimeLocalValue(null), '')
    assert.equal(toDateTimeLocalValue(undefined), '')
    assert.equal(toDateTimeLocalValue('not-a-date'), '')
  })
})
