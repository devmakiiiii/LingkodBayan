/**
 * Finite State Machine (FSM) definitions for the status lifecycles of
 * service requests and complaints.
 *
 * Each lifecycle is modeled as a deterministic finite automaton:
 * a set of states, an initial state, terminal (accepting) states, and a
 * transition relation. Every status change in the app — server actions,
 * API routes, and client components — should go through these guards so
 * illegal transitions (e.g. approved -> pending) are rejected in one
 * authoritative place instead of being enforced by ad-hoc checks.
 *
 * This module is intentionally dependency-free so it can run on the
 * server, in the browser, and in plain Node test runners.
 */

export type StatusMachineKind = 'request' | 'complaint'

export type RequestLifecycleStatus = 'pending' | 'processing' | 'approved' | 'rejected'

export type ComplaintLifecycleStatus = 'open' | 'under_investigation' | 'resolved' | 'dismissed'

export interface StatusTransition<S extends string = string> {
  from: S
  to: S
  /** Short verb phrase suitable for UI action labels, e.g. "Start Processing". */
  label: string
  description?: string
}

export interface StatusMachine<S extends string = string> {
  readonly kind: StatusMachineKind
  readonly initialState: S
  readonly states: readonly S[]
  readonly terminalStates: readonly S[]
  readonly transitions: readonly StatusTransition<S>[]
  /** Maps legacy / raw stored values onto canonical states (lowercased keys). */
  readonly aliases: Readonly<Record<string, S>>
}

/**
 * Request lifecycle:
 *
 *   pending ──▶ processing ──▶ approved (terminal)
 *      │            │
 *      │            ├──▶ rejected (terminal)
 *      │            └──▶ pending (send back to the queue)
 *      └──▶ rejected (terminal)
 */
export const requestStatusMachine: StatusMachine<RequestLifecycleStatus> = {
  kind: 'request',
  initialState: 'pending',
  states: ['pending', 'processing', 'approved', 'rejected'],
  terminalStates: ['approved', 'rejected'],
  transitions: [
    { from: 'pending', to: 'processing', label: 'Start Processing', description: 'Begin working on the request.' },
    { from: 'pending', to: 'rejected', label: 'Reject', description: 'Decline the request before processing.' },
    { from: 'processing', to: 'approved', label: 'Approve', description: 'Mark the request as completed.' },
    { from: 'processing', to: 'rejected', label: 'Reject', description: 'Decline the request after review.' },
    { from: 'processing', to: 'pending', label: 'Return to Pending', description: 'Send the request back to the queue.' },
  ],
  aliases: {
    pending: 'pending',
    processing: 'processing',
    'in-progress': 'processing',
    in_progress: 'processing',
    approved: 'approved',
    resolved: 'approved',
    rejected: 'rejected',
  },
}

/**
 * Complaint lifecycle:
 *
 *   open ──▶ under_investigation ──▶ resolved ──▶ dismissed (terminal)
 *    │  ▲          │    │               │
 *    │  └──────────┘    │               └──▶ under_investigation (reopen)
 *    ├──▶ resolved      └──▶ dismissed (terminal)
 *    └──▶ dismissed (terminal)
 *
 * Note: `resolved` is intentionally NOT terminal for complaints — the
 * admin UI supports reopening a resolved report ("Unresolve").
 */
export const complaintStatusMachine: StatusMachine<ComplaintLifecycleStatus> = {
  kind: 'complaint',
  initialState: 'open',
  states: ['open', 'under_investigation', 'resolved', 'dismissed'],
  terminalStates: ['dismissed'],
  transitions: [
    { from: 'open', to: 'under_investigation', label: 'Start Investigation', description: 'Begin reviewing the complaint.' },
    { from: 'open', to: 'resolved', label: 'Mark Resolved', description: 'Resolve the complaint without a formal investigation.' },
    { from: 'open', to: 'dismissed', label: 'Dismiss', description: 'Dismiss the complaint as invalid or out of scope.' },
    { from: 'under_investigation', to: 'resolved', label: 'Mark Resolved', description: 'Close the complaint as resolved.' },
    { from: 'under_investigation', to: 'dismissed', label: 'Dismiss', description: 'Dismiss the complaint after review.' },
    { from: 'under_investigation', to: 'open', label: 'Return to Pending', description: 'Send the complaint back to the queue.' },
    { from: 'resolved', to: 'under_investigation', label: 'Reopen', description: 'Reopen a resolved complaint for further review.' },
    { from: 'resolved', to: 'dismissed', label: 'Dismiss', description: 'Archive a resolved complaint as dismissed.' },
  ],
  aliases: {
    open: 'open',
    pending: 'open',
    under_investigation: 'under_investigation',
    under_review: 'under_investigation',
    processing: 'under_investigation',
    in_progress: 'under_investigation',
    'in-progress': 'under_investigation',
    resolved: 'resolved',
    approved: 'resolved',
    dismissed: 'dismissed',
    rejected: 'dismissed',
  },
}

/**
 * Error thrown when a status transition violates the machine definition.
 */
export class IllegalStatusTransitionError extends Error {
  readonly kind: StatusMachineKind
  readonly from: string
  readonly to: string
  readonly allowedTargets: readonly string[]

  constructor(kind: StatusMachineKind, from: string, to: string, allowedTargets: readonly string[]) {
    const allowedMessage =
      allowedTargets.length > 0
        ? `Allowed next statuses: ${allowedTargets.join(', ')}.`
        : `"${from}" is a terminal status and cannot be changed.`
    super(`Invalid ${kind} status transition: "${from}" → "${to}". ${allowedMessage}`)
    this.name = 'IllegalStatusTransitionError'
    this.kind = kind
    this.from = from
    this.to = to
    this.allowedTargets = allowedTargets
  }
}

/**
 * Resolve a raw stored value to its canonical state, or null when the
 * value is not recognized at all.
 */
function resolveStatus<S extends string>(machine: StatusMachine<S>, status?: string | null): S | null {
  if (!status) {
    return null
  }

  return machine.aliases[status.trim().toLowerCase()] ?? null
}

/**
 * Normalize any raw / legacy status value to its canonical state.
 * Unknown or missing values fall back to the machine's initial state
 * (useful for reading legacy rows; do NOT use this for write targets).
 */
export function normalizeStatus<S extends string>(machine: StatusMachine<S>, status?: string | null): S {
  return resolveStatus(machine, status) ?? machine.initialState
}

export function isTerminalStatus<S extends string>(machine: StatusMachine<S>, status?: string | null): boolean {
  return machine.terminalStates.includes(normalizeStatus(machine, status))
}

/**
 * Check whether moving from `fromStatus` to `toStatus` is a legal
 * transition. Unknown source values are normalized leniently (legacy
 * data), while unknown target values are always rejected.
 */
export function canTransition<S extends string>(
  machine: StatusMachine<S>,
  fromStatus?: string | null,
  toStatus?: string | null,
): boolean {
  const from = normalizeStatus(machine, fromStatus)
  const to = resolveStatus(machine, toStatus)

  if (!to || from === to) {
    return false
  }

  return machine.transitions.some((transition) => transition.from === from && transition.to === to)
}

/**
 * Get every transition available from the given (possibly raw) status.
 */
export function getAllowedTransitions<S extends string>(
  machine: StatusMachine<S>,
  fromStatus?: string | null,
): StatusTransition<S>[] {
  const from = normalizeStatus(machine, fromStatus)
  return machine.transitions.filter((transition) => transition.from === from)
}

/**
 * Assert that a transition is legal, throwing IllegalStatusTransitionError
 * otherwise. Returns the canonical target state on success.
 */
export function assertTransition<S extends string>(
  machine: StatusMachine<S>,
  fromStatus?: string | null,
  toStatus?: string | null,
): S {
  const from = normalizeStatus(machine, fromStatus)
  const to = resolveStatus(machine, toStatus)

  if (!to || from === to || !canTransition(machine, from, to)) {
    throw new IllegalStatusTransitionError(
      machine.kind,
      from,
      to ?? String(toStatus ?? ''),
      getAllowedTransitions(machine, from).map((transition) => transition.to),
    )
  }

  return to
}

/* ------------------------------------------------------------------ */
/* Convenience wrappers bound to each concrete machine                 */
/* ------------------------------------------------------------------ */

export function normalizeRequestLifecycleStatus(status?: string | null): RequestLifecycleStatus {
  return normalizeStatus(requestStatusMachine, status)
}

export function canTransitionRequest(fromStatus?: string | null, toStatus?: string | null): boolean {
  return canTransition(requestStatusMachine, fromStatus, toStatus)
}

export function getAllowedRequestTransitions(fromStatus?: string | null): StatusTransition<RequestLifecycleStatus>[] {
  return getAllowedTransitions(requestStatusMachine, fromStatus)
}

export function assertRequestTransition(fromStatus?: string | null, toStatus?: string | null): RequestLifecycleStatus {
  return assertTransition(requestStatusMachine, fromStatus, toStatus)
}

export function isTerminalRequestStatus(status?: string | null): boolean {
  return isTerminalStatus(requestStatusMachine, status)
}

export function normalizeComplaintLifecycleStatus(status?: string | null): ComplaintLifecycleStatus {
  return normalizeStatus(complaintStatusMachine, status)
}

export function canTransitionComplaint(fromStatus?: string | null, toStatus?: string | null): boolean {
  return canTransition(complaintStatusMachine, fromStatus, toStatus)
}

export function getAllowedComplaintTransitions(fromStatus?: string | null): StatusTransition<ComplaintLifecycleStatus>[] {
  return getAllowedTransitions(complaintStatusMachine, fromStatus)
}

export function assertComplaintTransition(fromStatus?: string | null, toStatus?: string | null): ComplaintLifecycleStatus {
  return assertTransition(complaintStatusMachine, fromStatus, toStatus)
}

export function isTerminalComplaintStatus(status?: string | null): boolean {
  return isTerminalStatus(complaintStatusMachine, status)
}

