-- Migration 37: Backfill verification_status into auth.users.user_metadata
--
-- lib/db.ts mirrors `verification_status` into `user_metadata` so middleware can
-- read it without a database round-trip. That mirror only exists for accounts
-- verified AFTER that change. Residents verified before it have no claim, so the
-- middleware redirect in middleware.ts never fires for them and they meet the
-- RLS gate (migration 36) as a raw Postgres policy error instead of being sent
-- to /citizen/verify-id.
--
-- This backfills the claim from the authoritative source — the `residents` row
-- — so the UX path works for pre-existing accounts.
--
-- Scope is deliberately narrow:
--   * Only residents whose status is genuinely one of the five known values.
--   * Only rows that do not already carry the claim, so re-running is a no-op
--     and a status changed by an admin review afterwards is never overwritten
--     with a stale value.
--   * `jsonb_set` merges into the existing metadata document; this does not
--     replace it, so `role`, `phone`, and `address` are preserved. That matters
--     most for admins: middleware routes on `role`, and losing it would lock
--     every admin out of /admin.
--
-- NOTE ON auth.users: this table is owned by Supabase's GoTrue, which is why
-- lib/db.ts writes metadata through the admin API rather than SQL. A direct
-- write is still done here deliberately and once, because there is no bulk
-- equivalent of the admin API. Keep it idempotent and run it during a quiet
-- period; GoTrue caches nothing that this would invalidate, but the change
-- propagates to sessions on next token refresh.
--
-- Idempotent: safe to re-run.

UPDATE auth.users AS au
SET raw_user_meta_data = jsonb_set(
      COALESCE(au.raw_user_meta_data, '{}'::jsonb),
      '{verification_status}',
      to_jsonb(r.verification_status),
      true
    )
FROM public.residents AS r
WHERE r.user_id = au.id
  AND r.verification_status IS NOT NULL
  AND r.verification_status IN ('unverified', 'auto_verified', 'id_verified', 'needs_review', 'rejected')
  -- Never clobber a claim that is already present: it may be newer than the
  -- residents row (an admin review can update the row via a path that does not
  -- rewrite metadata, e.g. a direct SQL change).
  AND NOT (au.raw_user_meta_data ? 'verification_status');

-- Inspect what the backfill touched, and confirm no admin lost its role.
-- Expect one row per resident that predates the metadata mirror.
--
-- SELECT r.first_name, r.last_name, r.verification_status,
--        au.raw_user_meta_data->>'role' AS role,
--        au.raw_user_meta_data->>'verification_status' AS claim
-- FROM public.residents r
-- JOIN auth.users au ON au.id = r.user_id
-- ORDER BY r.last_name;

-- Safety net: should return zero rows. Restricted to admins who also have a
-- residents row, so ordinary staff accounts (no residents row) do not appear.
-- A non-empty result means an account that should be an admin lost the role.
--
-- SELECT au.email, au.raw_user_meta_data
-- FROM auth.users au
-- JOIN public.residents r ON r.user_id = au.id
-- WHERE (au.raw_user_meta_data->>'role') IN ('admin', 'super_admin')
--   AND NOT (au.raw_user_meta_data ? 'verification_status');