import { Sidebar } from '@/components/citizen/sidebar'
import { PageBreadcrumbs } from '@/components/page-breadcrumbs'
import { NotificationProvider } from '@/hooks/use-notifications'
import { Toaster } from '@/components/ui/sonner'

export default function CitizenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <NotificationProvider>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto">
          {/* Sticky breadcrumb bar; pl-16 on mobile clears the fixed menu button */}
          <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 pl-16 backdrop-blur md:pl-6">
            <PageBreadcrumbs />
          </div>
          {children}
        </main>
      </div>
      <Toaster />
    </NotificationProvider>
  )
}
