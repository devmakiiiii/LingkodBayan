import { notFound } from 'next/navigation'
import { getPublishedAnnouncementById } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Announcement {
  id: string
  title: string
  content: string
  category: string
  created_at: string
  image_url?: string | null
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

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const announcement = await getPublishedAnnouncementById(id)

  if (!announcement) {
    notFound()
  }

  const announcementData = {
    ...announcement,
    image_url: (announcement as any).image_url || null,
  }

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
          <div className="relative aspect-video bg-gray-100">
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
            <Badge className={getCategoryColor(announcementData.category)} variant="outline">
              {announcementData.category}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Calendar className="h-4 w-4" />
            <span>Published on {formatDate(announcementData.created_at)}</span>
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