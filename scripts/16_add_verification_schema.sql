-- Migration 16: Add identity verification schema
-- Adds verification tracking to residents and creates pre-registration tables

-- ============================================================================
-- Residents: Add verification columns
-- ============================================================================

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS verification_status TEXT
    DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'auto_verified', 'id_verified', 'needs_review', 'rejected')),
  ADD COLUMN IF NOT EXISTS verification_method TEXT
    CHECK (verification_method IN ('form_match', 'id_ocr', 'manual', 'admin_override')),
  ADD COLUMN IF NOT EXISTS verification_confidence NUMERIC(5,2) CHECK (verification_confidence >= 0 AND verification_confidence <= 100),
  ADD COLUMN IF NOT EXISTS verification_details JSONB,
  ADD COLUMN IF NOT EXISTS id_document_type TEXT,
  ADD COLUMN IF NOT EXISTS id_document_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_residents_verification_status ON public.residents (verification_status);

-- ============================================================================
-- Pre-registered residents (pre-saved data before user signs up)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pre_registered_residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  date_of_birth DATE,
  email TEXT NOT NULL,
  phone TEXT,
  street_address TEXT,
  barangay TEXT NOT NULL,
  city_municipality TEXT,
  province TEXT DEFAULT 'Metro Manila',
  postal_code TEXT,
  national_id TEXT,
  id_type TEXT CHECK (id_type IN ('philsys', 'drivers_license', 'passport', 'voter', 'sss', 'tin', 'umid')),
  source TEXT NOT NULL DEFAULT 'manual',
  import_batch_id TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT pre_registered_residents_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_pre_reg_residents_name ON public.pre_registered_residents (first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_pre_reg_residents_phone ON public.pre_registered_residents (phone);
CREATE INDEX IF NOT EXISTS idx_pre_reg_residents_national_id ON public.pre_registered_residents (national_id);
CREATE INDEX IF NOT EXISTS idx_pre_reg_residents_source ON public.pre_registered_residents (source);

-- ============================================================================
-- Verification attempts (audit log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('form_match', 'id_ocr', 'manual_review')),
  input_data JSONB,
  matched_pre_registered_id UUID REFERENCES public.pre_registered_residents(id),
  match_score NUMERIC(5,2),
  confidence_breakdown JSONB,
  ocr_extracted_data JSONB,
  status TEXT NOT NULL CHECK (status IN ('matched', 'no_match', 'needs_review', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_attempts_resident ON public.verification_attempts (resident_id);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_status ON public.verification_attempts (status);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_attempt_type ON public.verification_attempts (attempt_type);

-- ============================================================================
-- RLS Policies for new tables
-- ============================================================================

ALTER TABLE public.pre_registered_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can view pre-registered residents
DROP POLICY IF EXISTS "Admins can view pre-registered residents" ON public.pre_registered_residents;
CREATE POLICY "Admins can view pre-registered residents" ON public.pre_registered_residents
  FOR SELECT USING (public.is_admin_user(auth.uid()));

-- Only admins can manage pre-registered residents
DROP POLICY IF EXISTS "Admins can manage pre-registered residents" ON public.pre_registered_residents;
CREATE POLICY "Admins can manage pre-registered residents" ON public.pre_registered_residents
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- Residents can view their own verification attempts
DROP POLICY IF EXISTS "Residents can view their own verification attempts" ON public.verification_attempts;
CREATE POLICY "Residents can view their own verification attempts" ON public.verification_attempts
  FOR SELECT USING (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );

-- Admins can view all verification attempts
DROP POLICY IF EXISTS "Admins can view all verification attempts" ON public.verification_attempts;
CREATE POLICY "Admins can view all verification attempts" ON public.verification_attempts
  FOR SELECT USING (public.is_admin_user(auth.uid()));
