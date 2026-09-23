/**
 * Canonical status presentation helpers for complaints.
 *
 * `lib/status-machine.ts` owns the complaint lifecycle (open ->
 * under_investigation -> resolved | dismissed) and knows how to fold legacy
 * stored values ("in-progress", "under_review", "approved", "rejected") onto
 * those canonical states. This module layers the citizen-facing labels and
 * badge styles on top of that single source of truth so the dashboard, the
 * complaint list, and the complaint detail page can never drift apart again.
 */
import {
  normalizeComplaintLifecycleStatus,
  type ComplaintLifecycleStatus,
} from './status-machine.ts'

export const complaintStatusLabels: Record<ComplaintLifecycleStatus, string> = {
  open: 'Open',
  under_investigation: 'Under Review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

export const complaintStatusClassNames: Record<ComplaintLifecycleStatus, string> = {
  open: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  under_investigation: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  dismissed: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
}

/** Options for the complaint status filter controls, in lifecycle order. */
export const complaintStatusFilterOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'open', label: complaintStatusLabels.open },
  { value: 'under_investigation', label: complaintStatusLabels.under_investigation },
  { value: 'resolved', label: complaintStatusLabels.resolved },
  { value: 'dismissed', label: complaintStatusLabels.dismissed },
] as const

/** Human-readable label for a raw or canonical complaint status. */
export function getComplaintStatusLabel(status?: string | null): string {
  return complaintStatusLabels[normalizeComplaintLifecycleStatus(status)]
}

/** Badge class names for a raw or canonical complaint status. */
export function getComplaintStatusClassName(status?: string | null): string {
  return complaintStatusClassNames[normalizeComplaintLifecycleStatus(status)]
}

/** Canonical complaint status for a raw stored value. */
export function getComplaintStatus(status?: string | null): ComplaintLifecycleStatus {
  return normalizeComplaintLifecycleStatus(status)
}

/** Whether a complaint status still needs the barangay's attention. */
export function isOpenComplaintStatus(status?: string | null): boolean {
  const canonical = normalizeComplaintLifecycleStatus(status)
  return canonical === 'open' || canonical === 'under_investigation'
}
