import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildComplaintTrackingNumber,
  buildRequestTrackingNumber,
  getPublicStatusLabel,
  normalizeTrackingCode,
  parseTrackingCode,
  trackingCodeToIdPrefix,
} from './tracking.ts'

describe('normalizeTrackingCode', () => {
  it('accepts well-formed codes', () => {
    assert.equal(normalizeTrackingCode('REQ-1A2B3C4D'), 'REQ-1A2B3C4D')
    assert.equal(normalizeTrackingCode('rpt-1a2b3c4d'), 'RPT-1A2B3C4D')
    assert.equal(normalizeTrackingCode('FB-20260927-AB3K'), 'FB-20260927-AB3K')
  })

  it('tolerates messy input', () => {
    assert.equal(normalizeTrackingCode('  req 1a2b3c4d '), 'REQ-1A2B3C4D')
    assert.equal(normalizeTrackingCode('RPT__1a2b3c4d'), 'RPT-1A2B3C4D')
    assert.equal(normalizeTrackingCode('1a2b3c4d'), 'REQ-1A2B3C4D')
  })

  it('rejects garbage and oversized input', () => {
    assert.equal(normalizeTrackingCode(''), null)
    assert.equal(normalizeTrackingCode(null), null)
    assert.equal(normalizeTrackingCode('hello world'), null)
    assert.equal(normalizeTrackingCode('REQ-123'), null)
    assert.equal(normalizeTrackingCode('RPT-1A2B3C4DE'), null)
  })
})

describe('parseTrackingCode', () => {
  it('classifies each code shape', () => {
    assert.equal(parseTrackingCode('REQ-1A2B3C4D'), 'request')
    assert.equal(parseTrackingCode('RPT-1A2B3C4D'), 'complaint')
    assert.equal(parseTrackingCode('FB-20260927-AB3K'), 'feedback')
    assert.equal(parseTrackingCode('XYZ-1A2B3C4D'), null)
  })
})

describe('trackingCodeToIdPrefix', () => {
  it('extracts id prefixes and rejects FB codes', () => {
    assert.equal(trackingCodeToIdPrefix('REQ-1A2B3C4D'), '1A2B3C4D')
    assert.equal(trackingCodeToIdPrefix('RPT-1A2B3C4D'), '1A2B3C4D')
    assert.equal(trackingCodeToIdPrefix('FB-20260927-AB3K'), null)
  })
})

describe('build tracking numbers', () => {
  it('mirrors the migration 11 derivation', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000'
    assert.equal(buildRequestTrackingNumber(id), 'REQ-123E4567')
    assert.equal(buildComplaintTrackingNumber(id), 'RPT-123E4567')
  })
})

describe('getPublicStatusLabel', () => {
  it('maps canonical and legacy statuses', () => {
    assert.equal(getPublicStatusLabel('request', 'pending'), 'Pending')
    assert.equal(getPublicStatusLabel('request', 'in-progress'), 'Processing')
    assert.equal(getPublicStatusLabel('request', 'resolved'), 'Approved')
    assert.equal(getPublicStatusLabel('complaint', 'under_investigation'), 'Under Review')
    assert.equal(getPublicStatusLabel('complaint', 'rejected'), 'Dismissed')
    assert.equal(getPublicStatusLabel('feedback', 'responded'), 'Response Sent')
  })

  it('falls back to Pending for unknown statuses', () => {
    assert.equal(getPublicStatusLabel('request', 'mysterious'), 'Pending')
    assert.equal(getPublicStatusLabel('complaint', null), 'Pending')
  })
})
