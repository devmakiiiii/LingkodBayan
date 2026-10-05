-- =====================================================================
-- Migration 47: Citizen notification preferences
--
-- Per-resident opt-in/opt-out flags for the in-app notification sources the
-- portal already generates (complaint_messages + user_notifications). The
-- citizen Settings page (`/citizen/settings`) writes rows here through
-- PUT /api/citizen/notification-preferences; the notifications hook filters
-- by these flags when they exist.
--
-- A missing row means "receive everything" (all defaults true), so the table
-- can ship without a data backfill and residents only get rows when they
-- actively change something. Delivery preferences (email/SMS digests) are a
-- later addition; the `channel` column shape keeps them possible without a
-- second migration.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Notification source categories shown on the Settings page.
  -- A NULL/absent row is treated as all-true by the reader.
  request_updates BOOLEAN NOT NULL DEFAULT TRUE,
  complaint_updates BOOLEAN NOT NULL DEFAULT TRUE,
  pickup_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  announcements BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_notification_preferences IS
  'Per-resident in-app notification opt-ins; absent row means all enabled.';

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_notification_preferences'
      AND policyname = 'Residents manage own notification preferences'
  ) THEN
    CREATE POLICY "Residents manage own notification preferences"
      ON public.user_notification_preferences
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
