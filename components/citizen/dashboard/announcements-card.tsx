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
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeDate } from '@/lib/format-date'
import { Megaphone } from 'lucide-react'

export interface DashboardAnnouncement {
  id: string
  title: string
  category: string
  created_at: string
  excerpt?: string | null
}

interface AnnouncementsCardProps {
  announcements: DashboardAnnouncement[]
  loading: boolean
}

function getCategoryClassName(category: string) {
  const colors: Record<string, string> = {
    event: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    update: 'bg-primary/10 text-primary border-primary/20',
    alert: 'bg-red-500/10 text-red-700 border-red-500/20',
    maintenance: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    news: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  }

  return (
    colors[category?.toLowerCase()] ??
    'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20'
  )
}

/** Latest published barangay announcements, mirroring `/citizen/announcements`. */
export function AnnouncementsCard({
  announcements,
  loading,
}: AnnouncementsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-primary/10 p-2" aria-hidden="true">
            <Megaphone className="h-4 w-4 text-primary" />
          </span>
          <div>
            <CardTitle className="text-base">Announcements</CardTitle>
            <CardDescription>Latest news from your barangay</CardDescription>
          </div>
        </div>
        <Link href="/citizen/announcements">
          <Button variant="ghost" size="sm">
            View all
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="space-y-2 border-b py-2 last:border-0">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))
        ) : announcements.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No announcements yet. Check back later.
          </p>
        ) : (
          announcements.map((announcement) => (
            <Link
              key={announcement.id}
              href={`/citizen/announcements/${announcement.id}`}
              className="block space-y-1 border-b py-2 last:border-0"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-2 text-sm font-medium">{announcement.title}</p>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs ${getCategoryClassName(announcement.category)}`}
                >
                  {announcement.category}
                </Badge>
              </div>
              {announcement.excerpt ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {announcement.excerpt}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground/80">
                {formatRelativeDate(announcement.created_at)}
              </p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}
