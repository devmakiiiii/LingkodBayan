import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { getPublishedAnnouncementById } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getAnnouncementCategoryColor } from '@/lib/announcement-categories'
import { sanitizeRichText } from '@/lib/html-sanitize'
import { formatDate } from '@/lib/format-date'
import { BARANGAY_DISPLAY_NAME } from '@/lib/barangay'

export const revalidate = 60

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

/**
 * Public, read-only view of a single announcement.
 *
 * The landing page surfaces announcements to logged-out visitors, so their
 * detail links have to resolve without a session. `/citizen/announcements/[id]`
 * sits behind the auth redirect in middleware.ts, which would bounce every
 * logged-out reader straight to the login page.
 *
 * This route only ever reads rows that are already published and not expired —
 * `getPublishedAnnouncementById` enforces both, including for a known id — so
 * it exposes nothing the public `/api/public/announcements` feed does not.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const announcement = await getPublishedAnnouncementById(id).catch(() => null)

  if (!announcement) {
    return { title: `Announcement not found | LingkodBayan` }
  }

  return {
    title: `${announcement.title} | LingkodBayan`,
    description: `Announcement from ${BARANGAY_DISPLAY_NAME}`,
  }
}

export default async function PublicAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // A fetch failure must not 500 the public page; an unreadable announcement is
  // indistinguishable from a missing one as far as this route is concerned.
  const announcement = (await getPublishedAnnouncementById(id).catch((error) => {
    console.error('Error loading public announcement:', error)
    return null
  })) as Announcement | null

  if (!announcement) {
    notFound()
  }

  const announcementData: Announcement = {
    ...announcement,
    // Defence in depth: rows written before sanitisation was added still exist,
    // so the stored HTML is cleaned again on the way to the browser.
    content: sanitizeRichText(announcement.content),
    image_url: announcement.image_url || null,
    published_at: announcement.published_at || null,
    updated_at: announcement.updated_at || null,
  }

  const publishedAt = announcementData.published_at || announcementData.created_at
  const wasUpdated =
    !!announcementData.updated_at &&
    new Date(announcementData.updated_at).getTime() - new Date(publishedAt).getTime() > 60_000

  return (
    <main id="main-content" className="min-h-screen">
      <div className="mx-auto max-w-4xl space-y-8 p-4 px-6 sm:p-8">
        <div className="flex items-center justify-between">
          <Link href="/#news">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {BARANGAY_DISPLAY_NAME}
            </Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="outline">Sign in</Button>
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
    </main>
  )
}