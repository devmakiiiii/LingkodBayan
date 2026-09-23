'use client'

import { Fragment } from 'react'

import {
  normalizeComplaintLifecycleStatus,
  normalizeRequestLifecycleStatus,
} from '@/lib/status-machine'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'

type TrackerKind = 'request' | 'complaint'

const positiveLabels: Record<TrackerKind, readonly string[]> = {
  request: ['Pending', 'Processing', 'Approved'],
  complaint: ['Open', 'Under Review', 'Resolved'],
}

const positiveStatuses: Record<TrackerKind, readonly string[]> = {
  request: ['pending', 'processing', 'approved'],
  complaint: ['open', 'under_investigation', 'resolved'],
}

const negativeLabels: Record<TrackerKind, string> = {
  request: 'Rejected',
  complaint: 'Dismissed',
}

const negativeStatuses: Record<TrackerKind, string> = {
  request: 'rejected',
  complaint: 'dismissed',
}

interface StatusTrackerProps {
  kind: TrackerKind
  status?: string | null
  className?: string
}

/**
 * Compact 3-step progress indicator derived from the status machines in
 * `lib/status-machine.ts`, so a citizen sees the same lifecycle the admin
 * panel acts on. Negative outcomes (rejected / dismissed) render as a single
 * terminal chip instead of a progress track, because the remaining steps are
 * no longer reachable.
 */
export function StatusTracker({ kind, status, className }: StatusTrackerProps) {
  const canonical =
    kind === 'request'
      ? normalizeRequestLifecycleStatus(status)
      : normalizeComplaintLifecycleStatus(status)

  const isNegative = canonical === negativeStatuses[kind]

  if (isNegative) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700',
          className,
        )}
      >
        <X className="h-3 w-3" aria-hidden="true" />
        {negativeLabels[kind]}
      </span>
    )
  }

  const labels = positiveLabels[kind]
  const steps = positiveStatuses[kind]
  const currentIndex = Math.max(0, steps.indexOf(canonical))
  const currentLabel = labels[currentIndex] ?? labels[0]

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="img"
      aria-label={`${kind === 'request' ? 'Request' : 'Complaint'} progress: ${currentLabel}, step ${currentIndex + 1} of ${labels.length}`}
    >
      {labels.map((label, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <Fragment key={label}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn('h-px w-3 sm:w-4', isDone || isCurrent ? 'bg-primary' : 'bg-border')}
              />
            ) : null}
            <span
              className={cn(
                'flex items-center gap-1 text-[11px]',
                isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] leading-none',
                  isDone && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary text-primary',
                  !isDone && !isCurrent && 'border-border',
                )}
              >
                {isDone ? <Check className="h-2.5 w-2.5" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}
