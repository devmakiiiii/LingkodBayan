export const revalidate = 60

import { cookies } from 'next/headers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyMedia } from '@/components/ui/empty'
import { Megaphone, Calendar, Pin } from 'lucide-react'
import Link from 'next/link'
import { getPublishedAnnouncements } from '@/lib/db'
import { getAnnouncementCategoryColor } from '@/lib/announcement-categories'
import { BARANGAY_DISPLAY_NAME } from '@/lib/barangay'
import { AnnouncementImage } from '@/components/announcement-image'
import { t as translate, normalizeLocale, LOCALE_HTML_LANG, type Locale } from '@/lib/i18n'

interface Announcement {
  id: string
  title: string
  content: string
  excerpt?: string | null
  category: string
  created_at: string
  published_at?: string | null
  expires_at?: string | null
  pinned?: boolean | null
  image_url?: string | null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
}

function getPreviewText(announcement: Announcement): string {
  if (announcement.excerpt) return announcement.excerpt
  return stripHtml(announcement.content)
}

const formatDate = (dateString: string, locale: Locale) => {
  return new Date(dateString).toLocaleDateString(LOCALE_HTML_LANG[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function AnnouncementsPage() {
  // Server-side locale: the citizen locale toggle writes an `lb-locale`
  // cookie (path=/, 1 year) on every change, so SSR can translate without a
  // client round-trip. The cookie is a plain request value, not a secret, so
  // reading it here is safe; unknown/absent values degrade to English.
  const cookieStore = await cookies()
  const locale = normalizeLocale(cookieStore.get('lb-locale')?.value)
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(key, locale, params)

  let dbAnnouncements: Announcement[] = []
  
  try {
    const data = await getPublishedAnnouncements()
    dbAnnouncements = data.map((a: any) => ({
      ...a,
      image_url: a.image_url || null,
      published_at: a.published_at || null,
      expires_at: a.expires_at || null,
      pinned: Boolean(a.pinned),
    })) as Announcement[]
  } catch (error) {
    console.error('Error loading announcements:', error)
  }

if (dbAnnouncements.length === 0) {
    return (
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{t('Announcements')}</h1>
              <p className="text-muted-foreground mt-1">
                {t('Latest news and updates from {barangay}', { barangay: BARANGAY_DISPLAY_NAME })}
              </p>
            </div>
          </div>
        </div>

        <Empty
          title={t('No announcements yet')}
          description={t('Check back later for updates from {barangay}', {
            barangay: BARANGAY_DISPLAY_NAME,
          })}
        >
          <EmptyMedia variant="icon">
            <Megaphone className="h-5 w-5" />
          </EmptyMedia>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('Announcements')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('Latest news and updates from {barangay}', { barangay: BARANGAY_DISPLAY_NAME })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
        {dbAnnouncements.map((announcement) => (
          <Link 
            key={announcement.id} 
            href={`/citizen/announcements/${announcement.id}`}
            className="block"
          >
            <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full">
              {announcement.image_url && (
                <AnnouncementImage src={announcement.image_url} alt={announcement.title} />
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-xl text-balance flex-1">{announcement.title}</CardTitle>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {announcement.pinned && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        <Pin className="mr-1 h-3 w-3" aria-hidden="true" />
                        {t('Pinned')}
                      </Badge>
                    )}
                    <Badge className={getAnnouncementCategoryColor(announcement.category)} variant="outline">
                      {announcement.category}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4">
                <p className="text-foreground/80 line-clamp-3">
                  {getPreviewText(announcement)}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t mt-auto">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(announcement.published_at || announcement.created_at, locale)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}