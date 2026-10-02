'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type NotificationContextType = {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
})

/**
 * Safety-net refresh cadence. Realtime push handles the common case; this only
 * covers deployments where Realtime is switched off, or where a
 * `postgres_changes` event is missed, so a stale badge still corrects itself
 * within a minute.
 */
const POLL_INTERVAL_MS = 60_000

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
    let cancelled = false
    let channel: RealtimeChannel | null = null
    const supabase = createClient()

    // Live updates: without this the badge only moved on a full page load,
    // because the provider persists across client-side navigation. Both tables
    // are added to the `supabase_realtime` publication by
    // scripts/44_enable_notifications_realtime.sql; RLS still scopes each
    // subscription to the signed-in resident's own rows. If the migration has
    // not been applied the subscription simply stays silent, and the
    // focus/poll fallbacks below keep the badge reasonably fresh.
    async function subscribeToNotifications() {
      await refreshUnreadCount()

      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return

      channel = supabase
        .channel(`citizen-notifications-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'complaint_messages', filter: `recipient_user_id=eq.${user.id}` },
          () => { void refreshUnreadCount() },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` },
          () => { void refreshUnreadCount() },
        )
        .subscribe()
    }

    subscribeToNotifications()

    // Fallbacks: re-check whenever the tab regains focus or becomes visible, and
    // on a slow interval, so the badge never drifts far from the database.
    const handleFocus = () => { void refreshUnreadCount() }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshUnreadCount()
    }
    const intervalId = window.setInterval(() => { void refreshUnreadCount() }, POLL_INTERVAL_MS)

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(intervalId)
      if (channel) supabase.removeChannel(channel)
    }
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