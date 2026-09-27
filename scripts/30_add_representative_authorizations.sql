-- ============================================================================
-- Migration 30: Representative authorizations (proxy filing)
--
-- Lets one resident authorize another registered resident (a family member,
-- neighbor, or purok leader) to file service requests on their behalf. This
-- is the access bridge for residents who cannot operate the portal
-- themselves: someone with a phone and an account can file for them.
--
-- Consent model:
--   * Only the represented resident (or an admin via service role) can grant.
--   * Either party can revoke.
--   * The requests INSERT policy is extended so a representative may insert
--     a request row for the represented resident ONLY while an active
--     authorization exists.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.representative_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  represented_resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  representative_resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  consent_note TEXT,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (represented_resident_id <> representative_resident_id)
);

CREATE INDEX IF NOT EXISTS representative_authorizations_represented_idx
  ON public.representative_authorizations(represented_resident_id);
CREATE INDEX IF NOT EXISTS representative_authorizations_representative_idx
  ON public.representative_authorizations(representative_resident_id);
-- At most one active authorization per (represented, representative) pair.
CREATE UNIQUE INDEX IF NOT EXISTS representative_authorizations_active_pair_idx
  ON public.representative_authorizations(represented_resident_id, representative_resident_id)
  WHERE status = 'active';

-- ----------------------------------------------------------------------------
-- SECURITY DEFINER helpers (bypass RLS recursion, mirroring 03_fix_residents_rls)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_resident_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.residents WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- Whether the current user may file a request for the given resident: either
-- it is their own profile, or that resident granted them an active proxy
-- authorization.
CREATE OR REPLACE FUNCTION public.can_file_request_for(target_resident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_resident_id = public.current_resident_id()
  OR EXISTS (
    SELECT 1 FROM public.representative_authorizations ra
    WHERE ra.represented_resident_id = target_resident_id
      AND ra.representative_resident_id = public.current_resident_id()
      AND ra.status = 'active'
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.representative_authorizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorizations visible to involved parties" ON public.representative_authorizations;
CREATE POLICY "Authorizations visible to involved parties"
  ON public.representative_authorizations
  FOR SELECT
  USING (
    represented_resident_id = public.current_resident_id()
    OR representative_resident_id = public.current_resident_id()
  );

-- Only the represented resident grants consent (admins use the service role,
-- which bypasses RLS, for assisted onboarding at the barangay hall).
DROP POLICY IF EXISTS "Represented resident can grant authorization" ON public.representative_authorizations;
CREATE POLICY "Represented resident can grant authorization"
  ON public.representative_authorizations
  FOR INSERT
  WITH CHECK (represented_resident_id = public.current_resident_id());

-- Either party may revoke (only to 'revoked'); updates by anyone else are
-- blocked by the WITH CHECK.
DROP POLICY IF EXISTS "Involved parties can revoke authorization" ON public.representative_authorizations;
CREATE POLICY "Involved parties can revoke authorization"
  ON public.representative_authorizations
  FOR UPDATE
  USING (
    represented_resident_id = public.current_resident_id()
    OR representative_resident_id = public.current_resident_id()
  )
  WITH CHECK (
    status = 'revoked'
    AND revoked_at IS NOT NULL
  );

-- ----------------------------------------------------------------------------
-- Allow proxy INSERTs on requests. The existing own-profile INSERT policy is
-- left untouched; this adds the authorized-representative path.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Representatives can file for authorized residents" ON public.requests;
CREATE POLICY "Representatives can file for authorized residents"
  ON public.requests
  FOR INSERT
  WITH CHECK (public.can_file_request_for(resident_id));
