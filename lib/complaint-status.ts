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

/**
 * Status badge recipes. Light-theme tints are paired with dark-theme variants
 * that reuse the same hue at low alpha so the four lifecycle states remain
 * instantly recognisable on the layered dark surfaces (AA contrast ~5:1).
 */
export const complaintStatusClassNames: Record<ComplaintLifecycleStatus, string> = {
  open: 'rounded-full border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300',
  under_investigation:
    'rounded-full border-sky-500/30 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300',
  resolved:
    'rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300',
  dismissed:
    'rounded-full border-slate-500/30 bg-slate-500/10 text-slate-700 dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-300',
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
