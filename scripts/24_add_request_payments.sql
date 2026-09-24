-- Migration 24: Save service requests together with their payment record
-- Adds a payment ledger entry per request so submitting a request also
-- captures the Citizen's Charter fee snapshot and how/whether it was paid.
-- Idempotent: safe to run multiple times.

-- ============================================================================
-- 1. REQUEST PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.request_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.requests(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,

  -- Charter fee snapshot (mirrors service_categories fee columns at save time)
  fee_type TEXT NOT NULL DEFAULT 'unspecified'
    CHECK (fee_type IN ('free', 'fixed', 'range', 'formula', 'variable', 'per_page', 'unspecified')),
  fee_amount_min NUMERIC(10,2),
  fee_amount_max NUMERIC(10,2),
  fee_description TEXT,

  -- Payment captured with the request
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_method TEXT NOT NULL DEFAULT 'pay_at_counter'
    CHECK (payment_method IN ('pay_at_counter', 'gcash', 'maya')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending_verification', 'paid', 'free')),
  reference_number TEXT,
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. UPDATED_AT MAINTENANCE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_request_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_request_payments_touch ON public.request_payments;
CREATE TRIGGER trg_request_payments_touch
  BEFORE UPDATE ON public.request_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_request_payment_updated_at();

-- ============================================================================
-- 3. ROW LEVEL SECURITY
--    Residents read/record payments for their own requests; admins manage all
--    (e.g. verifying a GCash/Maya reference and marking it paid).
-- ============================================================================
ALTER TABLE public.request_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Residents can view own request payments" ON public.request_payments;
DROP POLICY IF EXISTS "Residents can record payments for own requests" ON public.request_payments;
DROP POLICY IF EXISTS "Admins can view all request payments" ON public.request_payments;
DROP POLICY IF EXISTS "Admins can manage request payments" ON public.request_payments;

CREATE POLICY "Residents can view own request payments" ON public.request_payments
  FOR SELECT USING (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );

CREATE POLICY "Residents can record payments for own requests" ON public.request_payments
  FOR INSERT WITH CHECK (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
    AND request_id IN (
      SELECT r.id FROM public.requests r
      WHERE r.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can view all request payments" ON public.request_payments
  FOR SELECT USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can manage request payments" ON public.request_payments
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- ============================================================================
-- 4. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS request_payments_request_idx ON public.request_payments(request_id);
CREATE INDEX IF NOT EXISTS request_payments_resident_idx ON public.request_payments(resident_id);
CREATE INDEX IF NOT EXISTS request_payments_status_idx ON public.request_payments(payment_status);
