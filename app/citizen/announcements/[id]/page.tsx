export const revalidate = 60

import { notFound } from 'next/navigation'
import { getPublishedAnnouncementById } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { getAnnouncementCategoryColor } from '@/lib/announcement-categories'
import { sanitizeRichText } from '@/lib/html-sanitize'

interface Announcement {
  id: string
  title: string
  content: string
  category: string
  created_at: string
  updated_at?: string | null
  published_at?: string | null
  image_url?: string | null
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const announcement = await getPublishedAnnouncementById(id)

  if (!announcement) {
    notFound()
  }

  const announcementData = {
    ...announcement,
    // Defence in depth: rows written before sanitisation was added still exist,
    // so the stored HTML is cleaned again on the way to the browser.
    content: sanitizeRichText(announcement.content),
    image_url: (announcement as any).image_url || null,
    published_at: (announcement as any).published_at || null,
    updated_at: (announcement as any).updated_at || null,
  }

  const publishedAt = announcementData.published_at || announcementData.created_at
  const wasUpdated =
    !!announcementData.updated_at &&
    new Date(announcementData.updated_at).getTime() - new Date(publishedAt).getTime() > 60_000

  return (
    <div className="space-y-8 p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/citizen/announcements">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Announcements
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        {announcementData.image_url && (
          <div className="relative aspect-video bg-gray-100 dark:bg-muted">
            <img
              src={announcementData.image_url}
              alt={announcementData.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                const parent = e.currentTarget.parentElement
                if (parent) parent.innerHTML = ''
              }}
            />
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-3xl text-balance flex-1">{announcementData.title}</CardTitle>
            <Badge className={getAnnouncementCategoryColor(announcementData.category)} variant="outline">
              {announcementData.category}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground pt-2">
            <Calendar className="h-4 w-4" />
            <span>Published on {formatDate(publishedAt)}</span>
            {wasUpdated && announcementData.updated_at && (
              <span className="text-xs text-muted-foreground/80">
                · Updated {formatDate(announcementData.updated_at)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-slate max-w-none text-foreground prose-p:my-3 prose-headings:mb-3 prose-headings:mt-0 prose-ul:my-3 prose-ol:my-3"
            dangerouslySetInnerHTML={{ __html: announcementData.content }}
          />
        </CardContent>
      </Card>
    </div>
  )
}