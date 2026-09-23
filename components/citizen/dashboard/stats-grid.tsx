'use client'

import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ComplaintStatusCounts, RequestStatusCounts } from '@/lib/citizen-stats'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  XCircle,
} from 'lucide-react'

interface StatsGridProps {
  loading: boolean
  requests: RequestStatusCounts
  complaints: ComplaintStatusCounts
}

function BreakdownItem({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode
  label: string
  value: number
  className: string
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span aria-hidden="true">{icon}</span>
      <span>
        {value} {label}
      </span>
    </span>
  )
}

/**
 * Request and complaint totals. Every row lands in exactly one bucket
 * (see `lib/citizen-stats.ts`) so the figures reconcile with the totals on
 * the card rather than silently dropping in-between statuses.
 */
export function StatsGrid({ loading, requests, complaints }: StatsGridProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{requests.total}</div>
          <p className="text-xs text-muted-foreground">
            {requests.total === 0
              ? 'Service requests submitted'
              : `${requests.approved} approved · ${requests.rejected} rejected`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{requests.pending}</div>
          <p className="text-xs text-muted-foreground">Awaiting processing</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          <Loader2 className="h-4 w-4 text-sky-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{requests.processing}</div>
          <p className="text-xs text-muted-foreground">Currently being processed</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">My Complaints</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-2xl font-bold">{complaints.total}</div>
          {complaints.total > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <BreakdownItem
                icon={<Clock className="h-3 w-3" />}
                label="open"
                value={complaints.open}
                className="text-amber-600"
              />
              <BreakdownItem
                icon={<Loader2 className="h-3 w-3" />}
                label="under review"
                value={complaints.underReview}
                className="text-sky-600"
              />
              <BreakdownItem
                icon={<CheckCircle2 className="h-3 w-3" />}
                label="resolved"
                value={complaints.resolved}
                className="text-emerald-600"
              />
              {complaints.dismissed > 0 ? (
                <BreakdownItem
                  icon={<XCircle className="h-3 w-3" />}
                  label="dismissed"
                  value={complaints.dismissed}
                  className="text-muted-foreground"
                />
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Complaints filed</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
