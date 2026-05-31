-- Add missing INSERT policy for residents table
-- This allows users to create their own resident profile during signup
-- Only run if the functions don't exist yet

-- Helper functions that bypass RLS recursion when checking admin membership
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

-- Add INSERT policy for residents table
-- This is the CRITICAL fix for the dashboard error
DROP POLICY IF EXISTS "Residents can create their own profile" ON public.residents;

CREATE POLICY "Residents can create their own profile" ON public.residents
  FOR INSERT WITH CHECK (auth.uid() = user_id);