/**
 * Counting helpers for the citizen dashboard.
 *
 * Both lifecycles are finite state machines (see `lib/status-machine.ts`),
 * and stored rows may predate the canonical vocabulary ("in-progress",
 * "under_review", "approved", ...). Every helper here normalizes first, so
 * each row lands in exactly one bucket and the dashboard totals always
 * reconcile: pending + processing + approved + rejected === total.
 *
 * This module is dependency-free so it can be covered by the plain Node test
 * runner used by `npm test`.
 */
import {
  normalizeComplaintLifecycleStatus,
  normalizeRequestLifecycleStatus,
  type ComplaintLifecycleStatus,
  type RequestLifecycleStatus,
} from './status-machine.ts'

export interface RequestStatusCounts {
  total: number
  pending: number
  processing: number
  approved: number
  rejected: number
  /** Requests that still need barangay action (pending + processing). */
  inProgress: number
}

export interface ComplaintStatusCounts {
  total: number
  open: number
  underReview: number
  resolved: number
  dismissed: number
  /** Complaints that still need barangay action (open + under review). */
  inProgress: number
}

type StatusRow = { status?: string | null }

export function countRequestsByStatus(
  rows: readonly StatusRow[] | null | undefined,
): RequestStatusCounts {
  const counts: RequestStatusCounts = {
    total: rows?.length ?? 0,
    pending: 0,
    processing: 0,
    approved: 0,
    rejected: 0,
    inProgress: 0,
  }

  for (const row of rows ?? []) {
    const canonical: RequestLifecycleStatus = normalizeRequestLifecycleStatus(row.status)

    switch (canonical) {
      case 'pending':
        counts.pending += 1
        break
      case 'processing':
        counts.processing += 1
        break
      case 'approved':
        counts.approved += 1
        break
      case 'rejected':
        counts.rejected += 1
        break
    }
  }

  counts.inProgress = counts.pending + counts.processing
  return counts
}

export function countComplaintsByStatus(
  rows: readonly StatusRow[] | null | undefined,
): ComplaintStatusCounts {
  const counts: ComplaintStatusCounts = {
    total: rows?.length ?? 0,
    open: 0,
    underReview: 0,
    resolved: 0,
    dismissed: 0,
    inProgress: 0,
  }

  for (const row of rows ?? []) {
    const canonical: ComplaintLifecycleStatus = normalizeComplaintLifecycleStatus(row.status)

    switch (canonical) {
      case 'open':
        counts.open += 1
        break
      case 'under_investigation':
        counts.underReview += 1
        break
      case 'resolved':
        counts.resolved += 1
        break
      case 'dismissed':
        counts.dismissed += 1
        break
    }
  }

  counts.inProgress = counts.open + counts.underReview
  return counts
}

/** Newest-first sort that never mutates the input array. */
export function sortByCreatedAtDesc<T extends { created_at?: string | null }>(
  rows: readonly T[] | null | undefined,
): T[] {
  return [...(rows ?? [])].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  )
}
