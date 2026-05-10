-- Fix: Admins unable to update complaints (RLS policy missing WITH CHECK)
-- The existing UPDATE policy only has a USING clause but no WITH CHECK clause,
-- which means Supabase silently blocks the update and returns 0 rows.

-- Drop and recreate the admin update policy for complaints with both USING and WITH CHECK
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;

CREATE POLICY "Admins can update complaints" ON public.complaints
  FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- Also ensure admins can update complaint_messages (e.g., mark as read)
DROP POLICY IF EXISTS "Admins can update messages" ON public.complaint_messages;

CREATE POLICY "Admins can update messages" ON public.complaint_messages
  FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
