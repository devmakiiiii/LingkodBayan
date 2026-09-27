'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type NotificationContextType = {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
})

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUnreadCount(0)
      return
    }

    const { count, error } = await supabase
      .from('complaint_messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('recipient_user_id', user.id)

    if (error) {
      console.warn('Failed to load unread messages count:', error.message)
      setUnreadCount(0)
      return
    }

    // Include verification-decision notifications (migration 29). If the
    // deployment hasn't run the migration yet, degrade to complaint-only.
    let verificationUnread = 0
    const { count: verificationCount, error: verificationError } = await supabase
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('user_id', user.id)

    if (verificationError) {
      console.warn('user_notifications unavailable (migration 29 not applied?)')
    } else {
      verificationUnread = verificationCount || 0
    }

    setUnreadCount((count || 0) + verificationUnread)
  }, [])

  useEffect(() => {
    refreshUnreadCount()
  }, [refreshUnreadCount])

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}