'use client'

import Link from 'next/link'
import { toast } from 'sonner'

import { StatusTracker } from '@/components/citizen/status-tracker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Empty } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getComplaintStatusClassName,
  getComplaintStatusLabel,
} from '@/lib/complaint-status'
import { formatRelativeDate } from '@/lib/format-date'
import { Copy } from 'lucide-react'

export interface RecentComplaint {
  id: string
  title: string
  category: string
  status: string
  created_at: string
  tracking_number?: string | null
}

interface RecentComplaintsCardProps {
  complaints: RecentComplaint[]
  loading: boolean
}

function TrackingNumber({ value }: { value: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Tracking number copied')
    } catch {
      toast.error('Could not copy the tracking number')
    }
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      {value}
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy tracking number ${value}`}
        className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Copy className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  )
}

export function RecentComplaintsCard({
  complaints,
  loading,
}: RecentComplaintsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Recent Complaints</CardTitle>
          <CardDescription>Your latest complaints</CardDescription>
        </div>
        {complaints.length > 0 ? (
          <Link href="/citizen/my-complaints">
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </Link>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2 border-b py-2 last:border-0">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))
        ) : complaints.length === 0 ? (
          <Empty
            className="p-6 md:p-6"
            title="No complaints filed"
            description="Report an issue in your barangay and track how it is resolved."
            action={
              <Link href="/citizen/file-complaint">
                <Button size="sm" variant="outline">
                  File a Complaint
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            {complaints.map((complaint) => (
              <Link
                key={complaint.id}
                href={`/citizen/my-complaints/${complaint.id}`}
                className="block space-y-2 border-b py-2 last:border-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{complaint.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {complaint.category} · {formatRelativeDate(complaint.created_at)}
                    </p>
                  </div>
                  <Badge
                    className={`shrink-0 text-xs ${getComplaintStatusClassName(complaint.status)}`}
                  >
                    {getComplaintStatusLabel(complaint.status)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusTracker kind="complaint" status={complaint.status} />
                  {complaint.tracking_number ? (
                    <TrackingNumber value={complaint.tracking_number} />
                  ) : null}
                </div>
              </Link>
            ))}
            <Link href="/citizen/my-complaints" className="block pt-2">
              <Button variant="ghost" size="sm" className="w-full">
                View All Complaints
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
