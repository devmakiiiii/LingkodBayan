'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { Bell, MessageSquare, CheckCircle2 } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'

type NotificationItem = {
  id: string
  message: string
  created_at: string
  is_read: boolean
  complaint_id: string
  title?: string
  source?: 'complaint' | 'system'
  complaints?: {
    title: string | null
    status: string | null
  } | null
}

type UserNotificationRow = {
  id: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const { refreshUnreadCount } = useNotifications()

  useEffect(() => {
    async function loadNotifications() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error: messagesError } = await supabase
          .from('complaint_messages')
          .select('id, message, created_at, is_read, complaint_id, complaints(title, status)')
          .eq('recipient_user_id', user.id)
          .order('created_at', { ascending: false })

        if (messagesError) {
          console.warn('Failed to load notifications:', messagesError.message)
          setItems([])
        } else {
          const rows = (data || []).map(
            (item: NotificationItem) => ({ ...item, source: 'complaint' as const }),
          )

          // Merge in verification-decision notifications (migration 29).
          // Degrade silently if the migration hasn't been applied yet.
          const { data: userNotifs, error: userNotifsError } = await supabase
            .from('user_notifications')
            .select('id, title, body, link, is_read, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (userNotifsError) {
            console.warn('user_notifications unavailable (migration 29 not applied?)')
          } else {
            const systemRows: NotificationItem[] = ((userNotifs || []) as UserNotificationRow[]).map((row) => ({
              id: row.id,
              message: row.body ?? row.title,
              created_at: row.created_at,
              is_read: row.is_read,
              complaint_id: row.link ?? '',
              title: row.title,
              source: 'system' as const,
            }))
            rows.push(...systemRows)
            rows.sort((a: NotificationItem, b: NotificationItem) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          }

          const allRows = rows as NotificationItem[]
          setItems(allRows)

          const unreadIds = allRows.filter((item) => !item.is_read).map((item) => item.id)
          if (unreadIds.length > 0) {
            // Mark both sources read; the system source may not exist yet.
            await supabase.from('complaint_messages').update({ is_read: true }).in('id', unreadIds)
            await supabase.from('user_notifications').update({ is_read: true }).in('id', unreadIds)

            setItems((current) => current.map((item) => (unreadIds.includes(item.id) ? { ...item, is_read: true } : item)))

            await refreshUnreadCount()
          }
        }
      } catch (error) {
        console.error('Error loading notifications:', error)
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()
  }, [refreshUnreadCount])

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-3">
          <Bell className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1">Admin replies and updates on your complaints</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      ) : items.length === 0 ? (
        <Empty
          title="No notifications yet"
          description="Admin replies to your complaints will appear here"
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className={item.is_read ? 'opacity-75' : 'border-primary/30 shadow-sm'}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {item.source === 'system' ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <MessageSquare className="h-5 w-5 text-primary" />
                      )}
                      {item.source === 'system'
                        ? item.title ?? 'Notification'
                        : item.complaints?.title || 'Complaint Update'}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {new Date(item.created_at).toLocaleString('en-PH')}
                    </CardDescription>
                  </div>
                  <Badge variant={item.is_read ? 'secondary' : 'default'}>
                    {item.is_read ? 'Read' : 'New'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">{item.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}