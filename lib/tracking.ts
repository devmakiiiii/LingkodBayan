/**
 * Tracking-code helpers for the public "Track my request" page.
 *
 * The barangay surfaces three kinds of human-friendly codes:
 *  - Complaints / resident reports: `RPT-XXXXXXXX` (migration 11 stores a
 *    tracking_number column, but older rows are derived from the id prefix —
 *    the same fallback used by the citizen dashboard and admin pages).
 *  - Service requests: `REQ-XXXXXXXX`, derived from the id prefix (requests
 *    have no tracking_number column).
 *  - Feedback: `FB-YYYYMMDD-XXXX`, stored in feedback.tracking_number.
 *
 * This module is intentionally dependency-free so it runs on the server, in
 * the browser, and in the plain Node test runner.
 */

export type TrackedKind = 'request' | 'complaint' | 'feedback'

export const TRACKING_CODE_PATTERNS: Readonly<Record<TrackedKind, RegExp>> = {
  request: /^REQ-[0-9A-F]{8}$/i,
  complaint: /^RPT-[0-9A-F]{8}$/i,
  feedback: /^FB-\d{8}-[0-9A-Z]{4}$/i,
}

/**
 * Derives the display tracking number for a request row, mirroring the
 * `'REQ-' || UPPER(SUBSTRING(id::text, 1, 8))` convention used by complaints
 * (see `buildComplaintTrackingNumber`).
 */
export function buildRequestTrackingNumber(id: string): string {
  return `REQ-${id.slice(0, 8).toUpperCase()}`
}

/** Mirrors migration 11's complaint tracking number format. */
export function buildComplaintTrackingNumber(id: string): string {
  return `RPT-${id.slice(0, 8).toUpperCase()}`
}

/**
 * Normalizes free-text tracking input: trims whitespace, uppercases, and
 * collapses inner whitespace/dashes so "rpt 1a2b3c4d" becomes "RPT-1A2B3C4D".
 * Returns null when the input cannot possibly be a valid code.
 */
export function normalizeTrackingCode(raw?: string | null): string | null {
  if (!raw) return null
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!cleaned) return null

  for (const pattern of Object.values(TRACKING_CODE_PATTERNS)) {
    if (pattern.test(cleaned)) return cleaned
  }

  // Tolerate a missing prefix when an 8-hex id prefix was quoted alone.
  if (/^[0-9A-F]{8}$/.test(cleaned)) {
    return `REQ-${cleaned}`
  }

  return null
}

/** Returns the tracked kind for a normalized code, or null for unknown shapes. */
export function parseTrackingCode(normalized: string): TrackedKind | null {
  if (TRACKING_CODE_PATTERNS.request.test(normalized)) return 'request'
  if (TRACKING_CODE_PATTERNS.complaint.test(normalized)) return 'complaint'
  if (TRACKING_CODE_PATTERNS.feedback.test(normalized)) return 'feedback'
  return null
}

/** Extracts the id prefix embedded in a REQ-/RPT- code (null for FB- codes). */
export function trackingCodeToIdPrefix(normalized: string): string | null {
  const kind = parseTrackingCode(normalized)
  if (kind !== 'request' && kind !== 'complaint') return null
  return normalized.slice(4)
}

/* ------------------------------------------------------------------ */
/* Public status presentation (non-personal, safe to show to anyone    */
/* who knows the tracking code)                                        */
/* ------------------------------------------------------------------ */

const requestStatusLabels: Readonly<Record<string, string>> = {
  pending: 'Pending',
  processing: 'Processing',
  approved: 'Approved',
  resolved: 'Approved',
  rejected: 'Rejected',
  'in-progress': 'Processing',
}

const complaintStatusLabels: Readonly<Record<string, string>> = {
  open: 'Open',
  under_investigation: 'Under Review',
  'under_review': 'Under Review',
  'in-progress': 'Under Review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
  rejected: 'Dismissed',
}

const feedbackStatusLabels: Readonly<Record<string, string>> = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  under_evaluation: 'Under Evaluation',
  action_taken: 'Action Taken',
  responded: 'Response Sent',
  documented: 'Documented',
}

/** Human-readable status label for any tracked submission. */
export function getPublicStatusLabel(kind: TrackedKind, status?: string | null): string {
  const key = (status ?? '').toLowerCase().replace(/[\s]+/g, '_')
  const table =
    kind === 'request' ? requestStatusLabels : kind === 'complaint' ? complaintStatusLabels : feedbackStatusLabels
  return table[key] ?? 'Pending'
}
