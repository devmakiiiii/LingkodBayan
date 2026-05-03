-- Add missing INSERT policy for residents table
-- This allows users to create their own resident profile during signup

CREATE OR REPLACE FUNCTION public.is_admin_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = target_user_id
    AND role IN ('admin', 'super_admin')
  )
  OR coalesce((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin'), false)
  OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = target_user_id
    AND role = 'super_admin'
  )
  OR coalesce((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin', false)
  OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false);
$$;

DROP POLICY IF EXISTS "Residents can create their own profile" ON public.residents;

CREATE POLICY "Residents can create their own profile" ON public.residents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add INSERT policy for admin_users (for admin account creation)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can create new admin users" ON public.admin_users;

CREATE POLICY "Admins can create new admin users" ON public.admin_users
  FOR INSERT WITH CHECK (
    public.is_admin_user(auth.uid())
  );

-- Add SELECT policy for admin_users
DROP POLICY IF EXISTS "Admins can view all admin users" ON public.admin_users;

CREATE POLICY "Admins can view all admin users" ON public.admin_users
  FOR SELECT USING (
    public.is_admin_user(auth.uid())
  );

-- Add missing INSERT and SELECT policies for complaint_messages table
ALTER TABLE public.complaint_messages
ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.complaint_messages
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.complaint_messages
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

ALTER TABLE public.complaint_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages for their complaints" ON public.complaint_messages;

DROP POLICY IF EXISTS "Users can insert messages on their complaints" ON public.complaint_messages;

CREATE POLICY "Users can view messages for their complaints" ON public.complaint_messages
  FOR SELECT USING (
    recipient_user_id = auth.uid()
    OR
    complaint_id IN (
      SELECT id FROM public.complaints
      WHERE resident_id IN (
        SELECT id FROM public.residents WHERE user_id = auth.uid()
      )
    )
    OR
    public.is_admin_user(auth.uid())
  );

CREATE POLICY "Users can insert messages on their complaints" ON public.complaint_messages
  FOR INSERT WITH CHECK (
    complaint_id IN (
      SELECT id FROM public.complaints
      WHERE resident_id IN (
        SELECT id FROM public.residents WHERE user_id = auth.uid()
      )
    )
    OR
    public.is_admin_user(auth.uid())
  );

UPDATE public.complaint_messages cm
SET recipient_user_id = r.user_id
FROM public.complaints c
JOIN public.residents r ON r.id = c.resident_id
WHERE cm.complaint_id = c.id
  AND cm.recipient_user_id IS NULL;
