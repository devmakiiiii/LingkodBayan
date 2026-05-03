-- Check and setup admin user
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID from Supabase Auth

-- First, let's see what users exist
SELECT id, email, raw_user_meta_data, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Check if admin_users table has entries
SELECT * FROM public.admin_users;

-- To add yourself as admin (replace with your actual user ID):
-- INSERT INTO public.admin_users (user_id, first_name, last_name, email, role)
-- VALUES ('YOUR_USER_ID_HERE', 'Your First Name', 'Your Last Name', 'your@email.com', 'admin');

-- Check RLS policies on residents table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'residents';

-- Test the is_admin_user function (replace with your user ID)
-- SELECT public.is_admin_user('YOUR_USER_ID_HERE');