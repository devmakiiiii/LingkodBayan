-- COMPREHENSIVE FIX FOR ADMIN ACCESS
-- RUN ALL QUERIES IN ORDER IN SUPABASE SQL EDITOR

-- 1. CHECK CURRENT STATE
SELECT 'Current auth.users count:' as info, COUNT(*) FROM auth.users;
SELECT 'Current admin_users count:' as info, COUNT(*) FROM public.admin_users;
SELECT 'Current residents count:' as info, COUNT(*) FROM public.residents;
SELECT 'Current service_categories count:' as info, COUNT(*) FROM public.service_categories;
SELECT 'Current system_settings count:' as info, COUNT(*) FROM public.system_settings;

-- 2. CREATE TEST ADMIN USER (REPLACE WITH ACTUAL USER ID)
-- If you already have an admin user, skip this and use their actual ID
-- INSERT INTO public.admin_users (user_id, first_name, last_name, email, role)
-- VALUES ('your-user-id-here', 'Admin', 'User', 'admin@example.com', 'admin');

-- 3. UPDATE is_admin_user FUNCTION TO WORK WITHOUT JWT METADATA
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

-- 4. VERIFY THE FUNCTION WORKS (REPLACE with actual user ID)
-- SELECT public.is_admin_user('your-user-id-here') as is_admin;

-- 5. TEST QUERY AS ADMIN (should work after step 3)
-- SELECT COUNT(*) FROM public.residents;
-- SELECT COUNT(*) FROM public.service_categories;
-- SELECT COUNT(*) FROM public.system_settings;