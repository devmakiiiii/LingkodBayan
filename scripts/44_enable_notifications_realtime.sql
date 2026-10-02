-- =====================================================================
-- Migration 44: Enable Realtime for citizen notifications
--
-- The citizen notification badge (hooks/use-notifications.tsx) and the
-- notifications page read from two tables:
--   * complaint_messages  — admin replies / activity notes on a report
--   * user_notifications  — server-authored events (migration 29)
--
-- Previously the badge only refreshed on a full page load, so an admin reply
-- made while the resident had the portal open never moved the bell. The hook
-- now subscribes to Postgres changes on these tables, which requires each one
-- to be part of the `supabase_realtime` publication.
--
-- RLS still applies to Realtime: a subscriber only receives rows their SELECT
-- policies allow, so a resident only ever sees their own notifications.
--
-- REPLICA IDENTITY FULL is set so UPDATE/DELETE payloads carry the previous
-- row, which the user-scoped filters below rely on to match reliably.
-- =====================================================================

-- complaint_messages -------------------------------------------------------
ALTER TABLE public.complaint_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'complaint_messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_messages;
  END IF;
END
$$;

-- user_notifications -------------------------------------------------------
ALTER TABLE public.user_notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'user_notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END
$$;