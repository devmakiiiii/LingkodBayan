-- Migration 25: Fix verification_attempts RLS (INSERT/UPDATE policies)
-- Migration 16 enabled RLS on verification_attempts but only created SELECT
-- policies. Without INSERT/UPDATE policies, user-session writes were rejected:
--   * Residents' OCR attempts were silently dropped, so the admin review queue
--     never received `needs_review` entries.
--   * Admin approve/reject failed with a permission error (HTTP 500).

-- Residents can log verification attempts for their own profile (OCR uploads,
-- re-submissions, and rejected-verification appeals).
DROP POLICY IF EXISTS "Residents can log their own verification attempts" ON public.verification_attempts;
CREATE POLICY "Residents can log their own verification attempts" ON public.verification_attempts
  FOR INSERT WITH CHECK (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );

-- Admins can update attempts when reviewing them (status, reviewer, timestamp).
DROP POLICY IF EXISTS "Admins can review verification attempts" ON public.verification_attempts;
CREATE POLICY "Admins can review verification attempts" ON public.verification_attempts
  FOR UPDATE USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
