import { AlertCircle, CalendarClock, Inbox, UserPlus } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { BacklogDigest } from '@/lib/digest'
import { buildComplaintTrackingNumber, buildRequestTrackingNumber } from '@/lib/tracking'

/**
 * Presentational section for the weekly backlog digest on the admin dashboard.
 * Receives an already-computed `BacklogDigest` (see `lib/digest.ts`) plus an
 * optional `error` note and renders it — no data fetching happens here.
 */
export function BacklogDigestCard({
  digest,
  error,
}: {
  digest: BacklogDigest | null
  error?: string | null
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-semibold">Weekly Backlog Digest</CardTitle>
          <CardDescription>
            Open work older than a week and requests still waiting for an official.
          </CardDescription>
        </div>
        <CalendarClock className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {digest ? (
          <>
            {/* Counts */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{digest.totalOpenRequests}</div>
                <p className="text-xs text-muted-foreground">Open requests</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{digest.totalOpenComplaints}</div>
                <p className="text-xs text-muted-foreground">Open complaints</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-2xl font-bold">
                  {digest.unassignedRequests.length}
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">Needs assignment</p>
              </div>
            </div>

            {/* Aging lists */}
            <div className="grid gap-4 sm:grid-cols-2">
              <AgingList
                label="Aging requests"
                items={digest.agingRequests.slice(0, 5)}
                overflow={Math.max(0, digest.agingRequests.length - 5)}
                trackingNumber={buildRequestTrackingNumber}
                emptyText="No requests older than 7 days."
              />
              <AgingList
                label="Aging complaints"
                items={digest.agingComplaints.slice(0, 5)}
                overflow={Math.max(0, digest.agingComplaints.length - 5)}
                trackingNumber={buildComplaintTrackingNumber}
                emptyText="No complaints older than 7 days."
              />
            </div>

            <p className="text-sm text-muted-foreground">{digest.summary}</p>
          </>
        ) : !error ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Inbox className="h-4 w-4" /> Loading backlog…
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AgingList({
  label,
  items,
  overflow,
  emptyText,
  trackingNumber,
}: {
  label: string
  items: { id: string; title: string; ageDays: number }[]
  overflow: number
  emptyText: string
  trackingNumber: (id: string) => string
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-400/20 dark:bg-amber-400/5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Aging &gt; 7 days · {label}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="font-mono text-xs text-muted-foreground">{trackingNumber(item.id)}</span>{' '}
                <span className="truncate align-middle">{item.title}</span>
              </span>
              <span className="shrink-0 text-xs text-amber-700 dark:text-amber-300">{item.ageDays}d</span>
            </li>
          ))}
        </ul>
      )}
      {overflow > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">+{overflow} more not shown</p>
      ) : null}
    </div>
  )
}
