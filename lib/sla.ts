/**
 * SLA (Service Level Agreement) due-date helpers for service requests.
 *
 * Each request type carries a target number of Philippine business days
 * within which the barangay commits to complete the request. Due dates are
 * computed by skipping weekends only — no holiday calendar is modeled.
 *
 * This module is intentionally dependency-free so it can run on the server,
 * in the browser, and in plain Node test runners.
 */

import { isTerminalRequestStatus } from './status-machine.ts'
import { isKnownRequestType } from './request-types.ts'

/** Fallback SLA target for unknown / dynamic request types. */
export const DEFAULT_SLA_BUSINESS_DAYS = 5

/**
 * SLA policy map: target business days per known request type.
 * Unknown / dynamic request types fall back to DEFAULT_SLA_BUSINESS_DAYS.
 */
export const slaPolicy: Record<string, number> = {
  'barangay-clearance': 3,
  'certificate-residency': 2,
  'business-permit': 7,
  'good-moral': 3,
  indigency: 2,
}

/** Returns the SLA target in business days for a request type. */
export function getSlaBusinessDays(requestType?: string | null): number {
  if (isKnownRequestType(requestType)) {
    return slaPolicy[requestType] ?? DEFAULT_SLA_BUSINESS_DAYS
  }

  return DEFAULT_SLA_BUSINESS_DAYS
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()

  return day === 0 || day === 6
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Computes the SLA due date for a request created at `createdAt`, skipping
 * weekends only (Philippine business days; no holiday calendar).
 *
 * If the request was created on a weekend, counting starts on the next
 * business day. The returned date is set to the end (23:59:59.999) of the
 * target business day so "due today" remains true until midnight.
 */
export function computeSlaDueDate(createdAt: string | Date, businessDays: number): Date {
  const start = createdAt instanceof Date ? new Date(createdAt) : new Date(createdAt)
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)

  // Never start counting on a weekend.
  while (isWeekend(cursor)) {
    cursor.setDate(cursor.getDate() + 1)
  }

  let remaining = businessDays
  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + 1)
    if (!isWeekend(cursor)) {
      remaining -= 1
    }
  }

  const dueDate = new Date(cursor)
  dueDate.setHours(23, 59, 59, 999)

  return dueDate
}

export type SlaTone = 'ok' | 'due-soon' | 'overdue' | 'done'

export interface SlaStatusInput {
  created_at: string | null
  status: string | null
  request_type?: string | null
}

export interface SlaStatus {
  dueDate: Date | null
  label: string
  tone: SlaTone
  daysRemaining: number | null
}

/** Tailwind classes for rendering an SLA badge per tone. */
export function getSlaBadgeClassName(tone: SlaTone): string {
  switch (tone) {
    case 'overdue':
      return 'bg-rose-500/10 text-rose-700 border-rose-500/20'
    case 'due-soon':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20'
    case 'done':
      return 'bg-muted text-muted-foreground border-border'
    case 'ok':
    default:
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
  }
}

/**
 * Resolves the SLA status for a request.
 *
 * Requests in a terminal status (approved / rejected, including legacy
 * aliases like "resolved") report tone 'done' with no overdue math.
 * Otherwise the status is derived from the calendar-day gap between now and
 * the due date: >2 days remaining = 'ok', 0-2 days = 'due-soon',
 * past due = 'overdue'.
 */
export function getSlaStatus(request: SlaStatusInput, now: Date = new Date()): SlaStatus {
  if (isTerminalRequestStatus(request.status)) {
    return { dueDate: null, label: 'Completed', tone: 'done', daysRemaining: null }
  }

  if (!request.created_at) {
    return { dueDate: null, label: 'Due date unavailable', tone: 'ok', daysRemaining: null }
  }

  const dueDate = computeSlaDueDate(request.created_at, getSlaBusinessDays(request.request_type))

  // Calendar-day gap between today and the due date (due dates are set to the
  // end of the target business day, so "due today" holds until midnight).
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(dueDate)
  dueDay.setHours(0, 0, 0, 0)
  const daysRemaining = Math.round((dueDay.getTime() - today.getTime()) / DAY_MS)

  if (daysRemaining < 0) {
    const overdueBy = -daysRemaining

    return {
      dueDate,
      label: `Overdue by ${overdueBy} ${overdueBy === 1 ? 'day' : 'days'}`,
      tone: 'overdue',
      daysRemaining,
    }
  }

  if (daysRemaining === 0) {
    return { dueDate, label: 'Due today', tone: 'due-soon', daysRemaining }
  }

  if (daysRemaining === 1) {
    return { dueDate, label: 'Due tomorrow', tone: 'due-soon', daysRemaining }
  }

  return {
    dueDate,
    label: `Due in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`,
    tone: daysRemaining <= 2 ? 'due-soon' : 'ok',
    daysRemaining,
  }
}