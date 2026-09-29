import { Megaphone } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Empty, EmptyMedia } from '@/components/ui/empty'

export default function PublicAnnouncementNotFound() {
  return (
    <main id="main-content" className="min-h-screen">
      <div className="p-4 px-6 sm:p-8">
        <Empty
          title="Announcement not found"
          description="This announcement doesn't exist, is no longer published, or has expired."
        >
          <EmptyMedia variant="icon">
            <Megaphone className="h-5 w-5" />
          </EmptyMedia>
          <Link href="/">
            <Button variant="outline" size="sm" className="mt-4">
              Back to Home
            </Button>
          </Link>
        </Empty>
      </div>
    </main>
  )
}