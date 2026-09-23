'use client'

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getComplaintStatusClassName, getComplaintStatusLabel } from '@/lib/complaint-status'
import { formatRelativeDate } from '@/lib/format-date'
import { MessageSquare } from 'lucide-react'

export interface UnreadReply {
  id: string
  message: string
  created_at: string
  complaint_id: string
  complaint_title?: string | null
  complaint_status?: string | null
}

interface UnreadRepliesCardProps {
  replies: UnreadReply[]
  loading: boolean
}

/**
 * Surfaces the unread complaint replies counted by
 * `hooks/use-notifications.tsx`, so the bell badge leads somewhere
 * actionable instead of being a number with no context.
 */
export function UnreadRepliesCard({ replies, loading }: UnreadRepliesCardProps) {
  if (loading || replies.length === 0) {
    return null
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-primary/10 p-2" aria-hidden="true">
            <MessageSquare className="h-4 w-4 text-primary" />
          </span>
          <div>
            <CardTitle className="text-base">
              New replies from the Barangay
            </CardTitle>
            <CardDescription>
              {replies.length} unread update{replies.length === 1 ? '' : 's'} on your complaints
            </CardDescription>
          </div>
        </div>
        <Link href="/citizen/notifications">
          <Button variant="ghost" size="sm">
            View all
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {replies.map((reply) => (
          <Link
            key={reply.id}
            href={`/citizen/my-complaints/${reply.complaint_id}`}
            className="block space-y-1 border-b py-2 last:border-0"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="truncate text-sm font-medium">
                {reply.complaint_title || 'Your complaint'}
              </p>
              {reply.complaint_status ? (
                <Badge
                  className={`shrink-0 text-xs ${getComplaintStatusClassName(reply.complaint_status)}`}
                >
                  {getComplaintStatusLabel(reply.complaint_status)}
                </Badge>
              ) : null}
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{reply.message}</p>
            <p className="text-xs text-muted-foreground/80">
              {formatRelativeDate(reply.created_at)}
            </p>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
