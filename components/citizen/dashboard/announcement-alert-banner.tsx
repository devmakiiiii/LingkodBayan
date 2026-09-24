'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { DashboardAnnouncement } from '@/components/citizen/dashboard/announcements-card'
import { AlertTriangle, X } from 'lucide-react'

interface AnnouncementAlertBannerProps {
  /** Newest live announcement in the `Alert` category, or null when there is none. */
  alert: DashboardAnnouncement | null
  loading: boolean
}

function dismissedKey(id: string) {
  return `announcement-alert-dismissed:${id}`
}

/**
 * Surfaces the newest barangay Alert on the citizen dashboard so urgent notices
 * are not buried in the announcements list. Dismissal is remembered per
 * announcement, so the same notice does not reappear after being acknowledged.
 */
export function AnnouncementAlertBanner({ alert, loading }: AnnouncementAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  const alertId = alert?.id ?? null

  useEffect(() => {
    if (!alertId) return

    try {
      setDismissed(window.localStorage.getItem(dismissedKey(alertId)) === '1')
    } catch {
      // Storage can be unavailable (private browsing); dismissal then only
      // applies to the current page view.
      setDismissed(false)
    }
  }, [alertId])

  if (loading || !alert || !alertId || dismissed) return null

  function dismiss() {
    if (!alertId) return

    setDismissed(true)
    try {
      window.localStorage.setItem(dismissedKey(alertId), '1')
    } catch {
      // Ignored: dismissing still works for this page view.
    }
  }

  return (
    <div
      className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            Barangay Alert: {alert.title}
          </p>
          {alert.excerpt ? (
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">{alert.excerpt}</p>
          ) : null}
          <Link
            href={`/citizen/announcements/${alert.id}`}
            className="mt-2 inline-block text-sm font-medium text-red-800 underline underline-offset-2 dark:text-red-200"
          >
            Read the full announcement
          </Link>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-red-700 hover:text-red-900 dark:text-red-300"
          onClick={dismiss}
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
