import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyMedia } from '@/components/ui/empty'
import { Megaphone, Calendar } from 'lucide-react'
import Link from 'next/link'
import { getPublishedAnnouncements } from '@/lib/db'

interface Announcement {
  id: string
  title: string
  content: string
  excerpt?: string | null
  category: string
  created_at: string
  image_url?: string | null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
}

function getPreviewText(announcement: Announcement): string {
  if (announcement.excerpt) return announcement.excerpt
  return stripHtml(announcement.content)
}

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    'event': 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    'update': 'bg-primary/10 text-primary border-primary/20',
    'alert': 'bg-red-500/10 text-red-700 border-red-500/20',
    'maintenance': 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
    'news': 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  }
  return colors[category.toLowerCase()] || 'bg-gray-500/10 text-gray-700 border-gray-500/20'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function AnnouncementsPage() {
  let dbAnnouncements: Announcement[] = []
  
  try {
    const data = await getPublishedAnnouncements()
    dbAnnouncements = data.map((a: any) => ({
      ...a,
      image_url: a.image_url || null,
    })) as Announcement[]
  } catch (error) {
    console.error('Error loading announcements:', error)
  }

if (dbAnnouncements.length === 0) {
    return (
      <div className="space-y-8 p-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Announcements</h1>
              <p className="text-muted-foreground mt-1">Latest news and updates from your barangay</p>
            </div>
          </div>
        </div>

        <Empty
          title="No announcements yet"
          description="Check back later for updates from your barangay"
        >
          <EmptyMedia variant="icon">
            <Megaphone className="h-5 w-5" />
          </EmptyMedia>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Announcements</h1>
            <p className="text-muted-foreground mt-1">Latest news and updates from your barangay</p>
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
                <div className="relative aspect-video bg-gray-100">
                  <img
                    src={announcement.image_url}
                    alt={announcement.title}
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
                  <CardTitle className="text-xl text-balance flex-1">{announcement.title}</CardTitle>
                  <Badge className={getCategoryColor(announcement.category)} variant="outline">
                    {announcement.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4">
                <p className="text-foreground/80 line-clamp-3">
                  {getPreviewText(announcement)}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t mt-auto">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(announcement.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}