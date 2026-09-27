-- ============================================================================
-- Migration 31: Document pickups (clearance claiming)
--
-- Bridges the portal to the physical world: after staff process a document
-- request (barangay clearance, certificate, etc.), they record a pickup.
-- When the document is signed and ready, the pickup gets a claim code and
-- the resident is notified. The resident (or anyone holding the claim code
-- / tracking code) can verify the pickup status without an account — useful
-- for residents who filed through a proxy or kiosk.
--
-- Lifecycle: preparing -> ready -> claimed
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.document_pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'ready', 'claimed')),
  pickup_code TEXT NOT NULL DEFAULT 'PICKUP-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
  document_title TEXT,
  scheduled_date DATE,
  ready_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  claimed_by_staff UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS document_pickups_resident_idx ON public.document_pickups(resident_id);
CREATE INDEX IF NOT EXISTS document_pickups_request_idx ON public.document_pickups(request_id);
CREATE INDEX IF NOT EXISTS document_pickups_status_idx ON public.document_pickups(status);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.document_pickups ENABLE ROW LEVEL SECURITY;

-- Residents see their own pickups; admins see all (is_admin_user comes from
-- migration 03 and is SECURITY DEFINER, so it avoids RLS recursion).
DROP POLICY IF EXISTS "Residents see their own pickups" ON public.document_pickups;
CREATE POLICY "Residents see their own pickups"
  ON public.document_pickups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = resident_id AND r.user_id = auth.uid()
    )
    OR public.is_admin_user(auth.uid())
  );

-- Residents may not create or modify pickups; staff act through the
-- service-role client which bypasses RLS. No INSERT/UPDATE/DELETE policies.
