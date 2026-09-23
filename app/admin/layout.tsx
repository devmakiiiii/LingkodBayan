import { AdminSidebar } from '@/components/admin/sidebar'
import { PageBreadcrumbs } from '@/components/page-breadcrumbs'
import { Toaster } from '@/components/ui/sonner'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background">
      <AdminSidebar />
      <main id="main-content" className="flex-1 overflow-y-auto">
        {/* Sticky breadcrumb bar; pl-16 on mobile clears the fixed menu button */}
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 pl-16 backdrop-blur md:pl-6">
          <PageBreadcrumbs />
        </div>
        {children}
      </main>
      <Toaster />
    </div>
  )
}
