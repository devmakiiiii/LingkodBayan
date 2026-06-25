import { getPublishedAnnouncements } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { Megaphone } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  content: string
  category: string
  created_at: string
  image_url?: string | null
}

export default async function AnnouncementsPage() {
  let announcements: Announcement[] = []
  
  try {
    const data = await getPublishedAnnouncements()
    announcements = data.map((a: any) => ({
      ...a,
      image_url: a.image_url || null,
    }))
  } catch (error) {
    console.error('Error loading announcements:', error)
    announcements = []
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

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
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

      {/* Announcements Grid */}
      {announcements.length === 0 ? (
        <Empty
          title="No announcements yet"
          description="Check back later for updates from your barangay"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
          {announcements.map((announcement) => (
            <Card key={announcement.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg text-balance">{announcement.title}</CardTitle>
                  </div>
                  <Badge className={getCategoryColor(announcement.category)} variant="outline">
                    {announcement.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                 {announcement.image_url && (
                   <img
                     src={announcement.image_url}
                     alt={announcement.title}
                     className="w-full rounded-lg object-cover max-h-64"
                   />
                 )}
                 <div
                   className="prose prose-slate max-w-none text-foreground/80 prose-p:my-3 prose-headings:mb-3 prose-headings:mt-0 prose-ul:my-3 prose-ol:my-3"
                   dangerouslySetInnerHTML={{ __html: announcement.content }}
                 />
                 <p className="text-xs text-muted-foreground">
                   {new Date(announcement.created_at).toLocaleDateString('en-US', {
                     year: 'numeric',
                     month: 'long',
                     day: 'numeric',
                   })}
                 </p>
               </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}