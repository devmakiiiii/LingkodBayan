import { Empty, EmptyMedia } from '@/components/ui/empty'
import { Megaphone } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AnnouncementNotFound() {
  return (
    <div className="p-8">
      <Empty
        title="Announcement not found"
        description="The announcement you're looking for doesn't exist or has been removed."
      >
        <EmptyMedia variant="icon">
          <Megaphone className="h-5 w-5" />
        </EmptyMedia>
        <Link href="/citizen/announcements">
          <Button variant="outline" size="sm" className="mt-4">
            Back to Announcements
          </Button>
        </Link>
      </Empty>
    </div>
  )
}