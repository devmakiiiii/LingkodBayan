/**
 * Workload balancing helpers for distributing resident reports (complaints)
 * and service requests evenly across barangay officials.
 *
 * "Active" work means rows whose canonical lifecycle status still needs
 * barangay action (complaints: open / under_investigation; requests:
 * pending / processing). Terminal rows (resolved, dismissed, approved,
 * rejected) and archived complaints only count toward the completed
 * totals. Stored rows may predate the canonical vocabulary, so every
 * status is normalized through the status machines first.
 *
 * Loads are priority-weighted (critical = 4, high = 3, medium = 2,
 * low = 1) so an official handling a few urgent cases is not treated as
 * less busy than one handling many trivial ones.
 *
 * This module is dependency-free so it can be covered by the plain Node
 * test runner used by `npm test`.
 */
import {
  normalizeComplaintLifecycleStatus,
  normalizeRequestLifecycleStatus,
} from './status-machine.ts'

export type WorkloadPriority = 'low' | 'medium' | 'high' | 'critical'

/** Relative cost of one active item, by priority. */
export const PRIORITY_WEIGHTS: Record<WorkloadPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

export interface WorkloadOfficialInput {
  id: string
  name: string
  designationLabel?: string | null
  /** Official status: 'active' | 'archived' (missing = active). Legacy 'inactive' rows are treated as non-assignable. */
  status?: string | null
}

export interface WorkloadItemInput {
  /** Unique row id, used by the bulk distribution planner. */
  id?: string
  assignedOfficialId?: string | null
  status?: string | null
  priority?: string | null
  /** Complaints only: archived rows are excluded from active load. */
  archivedAt?: string | null
}

export interface OfficialWorkload {
  officialId: string
  name: string
  designationLabel: string
  /** Active officials can receive new assignments. */
  isAssignable: boolean
  activeComplaints: number
  activeRequests: number
  activeTotal: number
  completedTotal: number
  /** Sum of PRIORITY_WEIGHTS over all active items. */
  weightedLoad: number
  /**
   * weightedLoad relative to the busiest official (0..1). 0 when nobody
   * has any active work, so it is safe to use directly as a bar width.
   */
  loadShare: number
}

export interface AssignmentPlanEntry {
  itemId: string
  officialId: string
  officialName: string
}

/** Fold raw stored priority values (incl. legacy "urgent"/"normal") onto the canonical set. */
export function normalizeWorkloadPriority(priority?: string | null): WorkloadPriority {
  switch ((priority ?? '').toLowerCase().trim()) {
    case 'critical':
      return 'critical'
    case 'high':
    case 'urgent':
      return 'high'
    case 'low':
      return 'low'
    default:
      // Covers 'medium', 'normal', '' and unknown values.
      return 'medium'
  }
}


/**
 * Aggregate complaints and requests into a per-official workload summary.
 * Rows assigned to an unknown official are ignored. Archived complaints
 * are excluded from both active and completed totals.
 */
export function computeOfficialWorkloads(
  officials: readonly WorkloadOfficialInput[] | null | undefined,
  complaints: readonly WorkloadItemInput[] | null | undefined,
  requests: readonly WorkloadItemInput[] | null | undefined = [],
): OfficialWorkload[] {
  const workloads = (officials ?? []).map((official) => ({
    officialId: official.id,
    name: official.name,
    designationLabel: official.designationLabel || 'Official',
    isAssignable: isActiveOfficialStatus(official.status),
    activeComplaints: 0,
    activeRequests: 0,
    activeTotal: 0,
    completedTotal: 0,
    weightedLoad: 0,
    loadShare: 0,
  }))
  const byId = new Map(workloads.map((workload) => [workload.officialId, workload]))

  for (const complaint of complaints ?? []) {
    if (complaint.archivedAt) continue
    const workload = complaint.assignedOfficialId ? byId.get(complaint.assignedOfficialId) : undefined
    if (!workload) continue

    const canonical = normalizeComplaintLifecycleStatus(complaint.status)
    if (canonical === 'open' || canonical === 'under_investigation') {
      workload.activeComplaints += 1
      workload.activeTotal += 1
      workload.weightedLoad += PRIORITY_WEIGHTS[normalizeWorkloadPriority(complaint.priority)]
    } else {
      workload.completedTotal += 1
    }
  }

  for (const request of requests ?? []) {
    const workload = request.assignedOfficialId ? byId.get(request.assignedOfficialId) : undefined
    if (!workload) continue

    const canonical = normalizeRequestLifecycleStatus(request.status)
    if (canonical === 'pending' || canonical === 'processing') {
      workload.activeRequests += 1
      workload.activeTotal += 1
      workload.weightedLoad += PRIORITY_WEIGHTS[normalizeWorkloadPriority(request.priority)]
    } else {
      workload.completedTotal += 1
    }
  }

  const maxLoad = workloads.reduce((max, workload) => Math.max(max, workload.weightedLoad), 0)
  for (const workload of workloads) {
    workload.loadShare = maxLoad > 0 ? workload.weightedLoad / maxLoad : 0
  }

  return workloads
}

/**
 * Pick the least-loaded assignable official. Ties break toward fewer
 * active items, then alphabetically, so the result is deterministic.
 * Returns null when no official can take work.
 */
export function suggestAssignee(
  workloads: readonly OfficialWorkload[] | null | undefined,
  options?: { excludeIds?: readonly string[] },
): OfficialWorkload | null {
  const excluded = new Set(options?.excludeIds ?? [])
  const candidates = (workloads ?? []).filter(
    (workload) => workload.isAssignable && !excluded.has(workload.officialId),
  )
  if (candidates.length === 0) return null

  return [...candidates].sort((a, b) =>
    a.weightedLoad - b.weightedLoad
    || a.activeTotal - b.activeTotal
    || a.name.localeCompare(b.name)
    || a.officialId.localeCompare(b.officialId),
  )[0]
}

/**
 * Greedily assign unassigned items to the least-loaded assignable
 * officials. Heavier items are placed first and each placement updates
 * the simulated load, so the resulting distribution stays even. Pure:
 * the input workloads are not mutated.
 */
export function planEvenDistribution(
  items: readonly { id: string; priority?: string | null }[] | null | undefined,
  workloads: readonly OfficialWorkload[] | null | undefined,
): AssignmentPlanEntry[] {
  const candidates = (workloads ?? []).filter((workload) => workload.isAssignable)
  if (candidates.length === 0) return []

  const simulatedLoads = new Map(candidates.map((workload) => [workload.officialId, workload.weightedLoad]))
  const byId = new Map(candidates.map((workload) => [workload.officialId, workload]))

  const queue = [...(items ?? [])].sort(
    (a, b) =>
      PRIORITY_WEIGHTS[normalizeWorkloadPriority(b.priority)]
      - PRIORITY_WEIGHTS[normalizeWorkloadPriority(a.priority)]
      || a.id.localeCompare(b.id),
  )

  const plan: AssignmentPlanEntry[] = []
  for (const item of queue) {
    let bestId: string | null = null
    let bestLoad = Infinity
    for (const workload of candidates) {
      const load = simulatedLoads.get(workload.officialId) ?? 0
      if (
        load < bestLoad
        || (load === bestLoad && bestId !== null && workload.name.localeCompare(byId.get(bestId)?.name ?? '') < 0)
      ) {
        bestId = workload.officialId
        bestLoad = load
      }
    }
    if (bestId === null) break

    simulatedLoads.set(bestId, bestLoad + PRIORITY_WEIGHTS[normalizeWorkloadPriority(item.priority)])
    plan.push({ itemId: item.id, officialId: bestId, officialName: byId.get(bestId)?.name ?? '' })
  }

  return plan
}

function isActiveOfficialStatus(status?: string | null): boolean {
  // Only 'active' (the default) is assignable. Archived — and any legacy
  // 'inactive' rows that predate migration 28 — receive no new work.
  return (status ?? 'active').toLowerCase().trim() === 'active'
}
