-- Fix: Admins unable to update complaints and send replies
-- The existing policies may be missing WITH CHECK clauses,
-- which causes Supabase to silently block writes and return errors.

-- 1. Fix admin UPDATE policy for complaints
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;

CREATE POLICY "Admins can update complaints" ON public.complaints
  FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- 2. Fix admin INSERT policy for complaint_messages (for sending replies)
DROP POLICY IF EXISTS "Admins can create messages" ON public.complaint_messages;

CREATE POLICY "Admins can create messages" ON public.complaint_messages
  FOR INSERT
  WITH CHECK (public.is_admin_user(auth.uid()));

-- 3. Fix admin UPDATE policy for complaint_messages (mark as read, etc.)
DROP POLICY IF EXISTS "Admins can update messages" ON public.complaint_messages;

CREATE POLICY "Admins can update messages" ON public.complaint_messages
  FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
