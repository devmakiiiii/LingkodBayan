/**
 * Pure computation helpers for the weekly backlog digest shown to officials.
 *
 * This module is intentionally dependency-free (no Supabase, no React) so it
 * can run on the server, in client components, and in the plain Node test
 * runner. Status classification is delegated to the authoritative lifecycle
 * definitions in `lib/status-machine.ts` / `lib/complaint-status.ts`.
 */
import { isTerminalRequestStatus } from './status-machine.ts'
import { isOpenComplaintStatus } from './complaint-status.ts'

export interface DigestRequest {
  id: string
  status: string | null
  created_at: string | null
  assigned_official?: string | null
  title?: string | null
}

export interface DigestComplaint {
  id: string
  status: string | null
  created_at: string | null
  title?: string | null
}

export interface DigestInput {
  requests: DigestRequest[]
  complaints: DigestComplaint[]
}

export interface AgingItem {
  id: string
  title: string
  ageDays: number
}

export interface BacklogDigest {
  agingRequests: AgingItem[]
  agingComplaints: AgingItem[]
  unassignedRequests: DigestRequest[]
  totalOpenRequests: number
  totalOpenComplaints: number
  summary: string
}

/** A request/complaint older than this many days is flagged as "aging". */
export const AGING_THRESHOLD_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Whole days between a row's created_at and `now`; null for missing dates. */
function ageInDays(created_at: string | null, now: Date): number | null {
  if (!created_at) return null
  const created = new Date(created_at)
  const elapsed = now.getTime() - created.getTime()
  if (!Number.isFinite(elapsed)) return null
  return Math.floor(elapsed / MS_PER_DAY)
}

/** True when the row is older than the aging threshold (strictly > 7 days). */
function isAging(created_at: string | null, now: Date): boolean {
  if (!created_at) return false
  const created = new Date(created_at)
  const elapsed = now.getTime() - created.getTime()
  return Number.isFinite(elapsed) && elapsed > AGING_THRESHOLD_DAYS * MS_PER_DAY
}

/** Display title fallback, mirroring other admin surfaces ("Untitled…"). */
function displayTitle(title: string | null | undefined, id: string): string {
  return title && title.trim().length > 0 ? title : `Untitled (${id.slice(0, 8)})`
}

/** Oldest first; rows with missing dates sink to the bottom, stable by id. */
function sortByOldestFirst<T extends { created_at: string | null; id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.POSITIVE_INFINITY
    const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.POSITIVE_INFINITY
    if (aTime !== bTime) return aTime - bTime
    return a.id.localeCompare(b.id)
  })
}

/**
 * Builds the weekly backlog digest from raw rows.
 *
 * - "Aging" items are active (non-terminal) and older than 7 days, oldest first.
 * - "Unassigned" requests are active requests with no assigned official.
 * - Active requests are pending/processing (terminal via the request FSM);
 *   active complaints are open/under investigation (resolved is re-openable).
 */
export function buildBacklogDigest(input: DigestInput, now: Date = new Date()): BacklogDigest {
  const requests = Array.isArray(input?.requests) ? input.requests : []
  const complaints = Array.isArray(input?.complaints) ? input.complaints : []

  // Active = not in a terminal state for requests; for complaints the FSM's
  // `resolved` state is intentionally non-terminal, so use the "open" helper.
  const activeRequests = requests.filter((row) => !isTerminalRequestStatus(row.status))
  const activeComplaints = complaints.filter((row) => isOpenComplaintStatus(row.status))

  const agingRequests = sortByOldestFirst(
    activeRequests.filter((row) => isAging(row.created_at, now)),
  ).map((row) => ({
    id: row.id,
    title: displayTitle(row.title, row.id),
    ageDays: ageInDays(row.created_at, now) ?? 0,
  }))

  const agingComplaints = sortByOldestFirst(
    activeComplaints.filter((row) => isAging(row.created_at, now)),
  ).map((row) => ({
    id: row.id,
    title: displayTitle(row.title, row.id),
    ageDays: ageInDays(row.created_at, now) ?? 0,
  }))

  const unassignedRequests = sortByOldestFirst(
    activeRequests.filter((row) => !row.assigned_official || String(row.assigned_official).trim() === ''),
  )

  const totalOpenRequests = activeRequests.length
  const totalOpenComplaints = activeComplaints.length
  const totalOpen = totalOpenRequests + totalOpenComplaints
  const agingCount = agingRequests.length + agingComplaints.length
  const unassignedCount = unassignedRequests.length

  const parts: string[] = [
    `${totalOpen} open item${totalOpen === 1 ? '' : 's'}`,
  ]
  if (agingCount > 0) parts.push(`${agingCount} aging beyond 7 days`)
  if (unassignedCount > 0) parts.push(`${unassignedCount} awaiting assignment`)

  const summary =
    totalOpen === 0
      ? 'No open requests or complaints — the backlog is clear this week.'
      : `This week's backlog has ${parts.join(' and ')}.`

  return {
    agingRequests,
    agingComplaints,
    unassignedRequests,
    totalOpenRequests,
    totalOpenComplaints,
    summary,
  }
}
