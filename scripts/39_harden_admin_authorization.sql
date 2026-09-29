-- Migration 39: stop trusting user_metadata for admin authorization
--
-- WHY THIS IS NEEDED
-- ----------------------------------------------------------------------------
-- `public.is_admin_user()` guards every admin RLS policy, and until now it
-- accepted a role out of `auth.jwt() -> 'user_metadata'`. `user_metadata` is
-- writable by the signed-in account itself:
--
--     supabase.auth.updateUser({ data: { role: 'admin' } })
--
-- so any resident could mint an admin claim, refresh their session, and then
-- read or write every table whose policy calls is_admin_user() — residents,
-- requests, complaints, feedback, officials, system_settings, audit logs.
--
-- The application layer was already hardened to read `app_metadata` only
-- (lib/roles.ts, used by middleware.ts, lib/auth.ts, lib/admin-auth.ts and the
-- /api/admin/* handlers). This migration makes the database agree, so the two
-- can no longer disagree about who is an admin. A resident who forges
-- `user_metadata.role` is then rejected at both layers.
--
-- ORDER OF OPERATIONS
-- ----------------------------------------------------------------------------
-- Step 1 first copies `user_metadata.role` into `app_metadata.role` for any
-- account that only ever had the role in the writable place, so a legitimate
-- admin provisioned before `scripts/setup_admin_account.js` started writing
-- `app_metadata` keeps access. Step 2 then removes the fallback. Run the whole
-- file; it is idempotent and safe to re-run.
--
-- NOTE ON auth.users: this table is owned by Supabase's GoTrue, which is why the
-- app writes metadata through the admin API rather than SQL. The direct write in
-- step 1 is deliberate and one-off because there is no bulk equivalent of the
-- admin API. Run it during a quiet period; the change reaches a session on its
-- next token refresh.

-- ---------------------------------------------------------------------------
-- Step 1: backfill app_metadata.role from user_metadata.role
-- ---------------------------------------------------------------------------
-- `jsonb_set` merges into the existing document instead of replacing it, so
-- `provider`, `providers`, and any other app_metadata keys are preserved.
UPDATE auth.users AS au
SET raw_app_meta_data = jsonb_set(
      COALESCE(au.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(au.raw_user_meta_data ->> 'role')
    )
WHERE (au.raw_user_meta_data ->> 'role') IN ('admin', 'super_admin')
  AND COALESCE(au.raw_app_meta_data ->> 'role', '') NOT IN ('admin', 'super_admin');

-- ---------------------------------------------------------------------------
-- Step 2: replace the admin helpers — admin_users membership + app_metadata
-- ---------------------------------------------------------------------------
-- Only the user_metadata branch is dropped; the admin_users lookup and the
-- app_metadata branch behave exactly as before.
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
  OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false);
$$;

-- ---------------------------------------------------------------------------
-- Verification (run these by hand; they are intentionally not executed)
-- ---------------------------------------------------------------------------
-- 1. Accounts that still carry an admin role ONLY in the writable metadata.
--    After step 1 this list should be empty, except for accounts you intend to
--    demote. Anyone left here is now treated as a plain resident.
--
-- SELECT au.id,
--        au.email,
--        au.raw_user_meta_data ->> 'role' AS user_metadata_role,
--        au.raw_app_meta_data  ->> 'role' AS app_metadata_role,
--        (SELECT count(*) FROM public.admin_users a WHERE a.user_id = au.id) AS admin_rows
-- FROM auth.users au
-- WHERE (au.raw_user_meta_data ->> 'role') IN ('admin', 'super_admin');
--
-- 2. Confirm the helpers no longer reference user_metadata. Neither body should
--    contain the text "user_metadata".
--
-- SELECT proname, prosrc FROM pg_proc
-- WHERE proname IN ('is_admin_user', 'is_super_admin_user');
--
-- 3. Prove a forged claim no longer grants access. Run once as a resident
--    (returns false) after calling
--    supabase.auth.updateUser({ data: { role: 'admin' } }) from the browser:
--
-- SELECT public.is_admin_user(auth.uid());
