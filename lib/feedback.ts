/**
 * Feedback module helpers (Citizen's Charter Section 18 — Feedback Mechanism).
 * SLA wording comes straight from the charter:
 *  - Acknowledgment: within 2 working days
 *  - Evaluation: 3–5 working days
 *  - Action & Resolution, Response: 7–10 working days
 *  - Documentation: recorded in the Feedback Registry
 */

import type { FeedbackLifecycleStatus } from '@/lib/status-machine'

export interface FeedbackEntry {
  id: string
  tracking_number: string | null
  resident_id: string | null
  is_anonymous: boolean
  category: string
  subject: string
  message: string
  contact_name: string | null
  contact_info: string | null
  status: string
  admin_response: string | null
  responded_at: string | null
  created_at: string
  updated_at: string
}

export const feedbackCategories: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'commendation', label: 'Commendation' },
  { value: 'concern', label: 'Concern' },
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'other', label: 'Other' },
]

export function getFeedbackCategoryLabel(value?: string | null): string {
  return feedbackCategories.find((c) => c.value === value)?.label ?? 'Other'
}

export const feedbackStatusLabels: Readonly<Record<FeedbackLifecycleStatus, string>> = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  under_evaluation: 'Under Evaluation',
  action_taken: 'Action & Resolution',
  responded: 'Response Sent',
  documented: 'Documented',
}

/** Charter SLA text for each stage, shown to citizens so expectations are clear. */
export const feedbackStatusSla: Readonly<Record<FeedbackLifecycleStatus, string>> = {
  submitted: 'Awaiting acknowledgment (within 2 working days)',
  acknowledged: 'Acknowledged — evaluation takes 3–5 working days',
  under_evaluation: 'Being evaluated by the barangay (3–5 working days)',
  action_taken: 'Action taken — a response is prepared (7–10 working days)',
  responded: 'The barangay has responded to your feedback',
  documented: 'Recorded in the Feedback Registry',
}

/** Generate a human-friendly tracking number, e.g. FB-20260924-7F3K. */
export function generateFeedbackTrackingNumber(now: Date = new Date()): string {
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `FB-${datePart}-${randomPart}`
}
