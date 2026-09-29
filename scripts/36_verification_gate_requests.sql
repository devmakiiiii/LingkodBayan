-- Migration 36: Require identity verification before filing a service request
--
-- Requests are inserted directly from the browser Supabase client
-- (components/citizen/request-form-dialog.tsx), not through lib/db.ts, so the
-- "Residents can create requests" RLS policy is the only enforcement point that
-- cannot be bypassed by the client. A middleware redirect or a guard in
-- lib/db.ts would not stop a crafted request against the REST API.
--
-- This replaces that policy with one that additionally requires the filing
-- resident to be verified. Complaints are deliberately NOT gated: restricting a
-- resident's ability to file a complaint could read as silencing them, which is
-- the wrong trade for a public-safety channel.
--
-- Allowlist, not denylist: only `auto_verified` and `id_verified` pass, so any
-- status added later is blocked until someone deliberately allows it. A pending
-- (`needs_review`) or rejected resident must keep reaching /citizen/verify-id,
-- the verification API routes, and the appeals endpoint — this policy only
-- governs `requests` inserts, so those paths are unaffected.
--
-- Admin inserts and the representative proxy route
-- (app/api/citizen/proxy-request) use the service-role key, which bypasses RLS;
-- the proxy route performs its own authorization check against
-- representative_authorizations.

DROP POLICY IF EXISTS "Residents can create requests" ON public.requests;

CREATE POLICY "Verified residents can create requests" ON public.requests
  FOR INSERT WITH CHECK (
    resident_id IN (
      SELECT r.id
      FROM public.residents r
      WHERE r.user_id = auth.uid()
        AND r.verification_status IN ('auto_verified', 'id_verified')
    )
  );