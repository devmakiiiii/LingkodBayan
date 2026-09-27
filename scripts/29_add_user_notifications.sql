-- =====================================================================
-- Migration 29: User notifications
--
-- Gives citizens in-app notifications for identity-verification decisions
-- (and any future non-complaint events). The existing notifications page
-- and unread badge only query complaint_messages, whose schema requires a
-- complaint_id FK, so verification decisions had nowhere to go.
--
-- Rows are inserted with the service-role client by server APIs
-- (e.g. app/api/admin/verification/attempts PATCH); users can only read
-- and mark their own as read.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',       -- e.g. verification_approved, verification_rejected
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                                 -- in-app route to open, e.g. /citizen/verify-id
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications (user_id, is_read, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.user_notifications;
CREATE POLICY "Users can view own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.user_notifications;
CREATE POLICY "Users can mark own notifications read" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No INSERT/DELETE policies on purpose: writes come from the server via the
-- service-role client (bypasses RLS), never directly from browsers.
