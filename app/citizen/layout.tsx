import { Sidebar } from '@/components/citizen/sidebar'
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
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <Toaster />
    </NotificationProvider>
  )
}
