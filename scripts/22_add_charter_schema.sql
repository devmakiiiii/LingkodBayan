-- Migration 22: Citizen's Charter 2025 (1st Edition) schema extensions
-- Barangay Barretto, Olongapo City
-- Adds: offices directory, charter service metadata, service steps,
--       feedback module (with SLA pipeline), and request status history.
-- Idempotent: safe to run multiple times.

-- ============================================================================
-- 1. OFFICES DIRECTORY (Citizen's Charter Section 20)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_key TEXT NOT NULL UNIQUE CHECK (office_key ~ '^[a-z0-9-]+$'),
  name TEXT NOT NULL,
  charter_category TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  facebook TEXT,
  sort_order INTEGER NOT NULL DEFAULT 999,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. CHARTER METADATA ON SERVICE CATEGORIES
--    (fees, processing times, classification, eligibility, office, etc.)
-- ============================================================================
ALTER TABLE public.service_categories
  ADD COLUMN IF NOT EXISTS office_key TEXT REFERENCES public.offices(office_key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classification TEXT,
  ADD COLUMN IF NOT EXISTS transaction_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS who_may_avail TEXT,
  ADD COLUMN IF NOT EXISTS fee_type TEXT NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS fee_amount_min NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fee_amount_max NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fee_description TEXT,
  ADD COLUMN IF NOT EXISTS processing_time_text TEXT,
  ADD COLUMN IF NOT EXISTS responsible_personnel TEXT,
  ADD COLUMN IF NOT EXISTS charter_section TEXT,
  ADD COLUMN IF NOT EXISTS directory_category TEXT;

-- Constrain the new columns (drop first for idempotency)
ALTER TABLE public.service_categories DROP CONSTRAINT IF EXISTS service_categories_classification_check;
ALTER TABLE public.service_categories ADD CONSTRAINT service_categories_classification_check
  CHECK (classification IS NULL OR classification IN ('simple', 'highly_technical'));

ALTER TABLE public.service_categories DROP CONSTRAINT IF EXISTS service_categories_fee_type_check;
ALTER TABLE public.service_categories ADD CONSTRAINT service_categories_fee_type_check
  CHECK (fee_type IN ('free', 'fixed', 'range', 'formula', 'variable', 'per_page', 'unspecified'));

ALTER TABLE public.service_categories DROP CONSTRAINT IF EXISTS service_categories_directory_category_check;
ALTER TABLE public.service_categories ADD CONSTRAINT service_categories_directory_category_check
  CHECK (directory_category IS NULL OR directory_category IN (
    'documents-certifications',
    'business-property',
    'health',
    'emergency-rescue',
    'peace-security',
    'child-development',
    'education-training',
    'complaints-feedback'
  ));

-- Widen the original category_type constraint so charter services such as
-- health services, emergency response, and justice services can be typed.
ALTER TABLE public.service_categories DROP CONSTRAINT IF EXISTS service_categories_category_type_check;
ALTER TABLE public.service_categories ADD CONSTRAINT service_categories_category_type_check
  CHECK (category_type IN ('document', 'appointment', 'incident', 'health', 'emergency', 'justice', 'program'));

-- ============================================================================
-- 3. SERVICE STEPS (client steps / agency actions from the charter)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.service_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  actor TEXT NOT NULL DEFAULT 'client' CHECK (actor IN ('client', 'agency')),
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT service_steps_unique_step UNIQUE (service_category_id, step_number)
);

-- ============================================================================
-- 4. FEEDBACK MODULE (Citizen's Charter Section 18)
--    Pipeline: submitted -> acknowledged -> under_evaluation ->
--              action_taken -> responded -> documented
--    SLA: acknowledge <= 2 working days; evaluate 3-5 working days;
--         respond 7-10 working days; record in Feedback Registry.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT UNIQUE,
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  category TEXT NOT NULL DEFAULT 'suggestion'
    CHECK (category IN ('suggestion', 'commendation', 'concern', 'inquiry', 'other')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  contact_name TEXT,
  contact_info TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  admin_response TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feedback_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. REQUEST STATUS HISTORY (audit trail + citizen timeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger: record every request status change (and the initial status)
CREATE OR REPLACE FUNCTION public.log_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.request_status_history (request_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_request_status_change ON public.requests;
CREATE TRIGGER trg_log_request_status_change
  AFTER INSERT OR UPDATE OF status ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.log_request_status_change();

-- Trigger: record every feedback status change (and the initial status)
CREATE OR REPLACE FUNCTION public.log_feedback_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.feedback_status_history (feedback_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 5b. COMPLAINT STATUS HISTORY (audit trail + citizen timeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger: record every complaint status change (and the initial status)
CREATE OR REPLACE FUNCTION public.log_complaint_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.complaint_status_history (complaint_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_complaint_status_change ON public.complaints;
CREATE TRIGGER trg_log_complaint_status_change
  AFTER INSERT OR UPDATE OF status ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.log_complaint_status_change();

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;

-- Offices: anyone can read the public directory; admins manage it
DROP POLICY IF EXISTS "Anyone can view active offices" ON public.offices;
DROP POLICY IF EXISTS "Admins can view all offices" ON public.offices;
DROP POLICY IF EXISTS "Admins can manage offices" ON public.offices;
CREATE POLICY "Anyone can view active offices" ON public.offices
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can view all offices" ON public.offices
  FOR SELECT USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admins can manage offices" ON public.offices
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- Service steps: anyone can read steps of active services; admins manage
DROP POLICY IF EXISTS "Anyone can view service steps" ON public.service_steps;
DROP POLICY IF EXISTS "Admins can manage service steps" ON public.service_steps;
CREATE POLICY "Anyone can view service steps" ON public.service_steps
  FOR SELECT USING (
    service_category_id IN (
      SELECT id FROM public.service_categories WHERE is_active = TRUE
    )
  );
CREATE POLICY "Admins can manage service steps" ON public.service_steps
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- Service requirements: citizens need to read requirement labels when
-- viewing a service's details (existing policy only allowed admins).
DROP POLICY IF EXISTS "Anyone can view service requirements" ON public.service_category_requirements;
CREATE POLICY "Anyone can view service requirements" ON public.service_category_requirements
  FOR SELECT USING (
    service_category_id IN (
      SELECT id FROM public.service_categories WHERE is_active = TRUE
    )
  );

-- Feedback: residents submit and view their own; admins manage everything
DROP POLICY IF EXISTS "Residents can submit feedback" ON public.feedback;
DROP POLICY IF EXISTS "Residents can view their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Residents can submit feedback" ON public.feedback
  FOR INSERT WITH CHECK (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );
CREATE POLICY "Residents can view their own feedback" ON public.feedback
  FOR SELECT USING (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins can view all feedback" ON public.feedback
  FOR SELECT USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admins can update feedback" ON public.feedback
  FOR UPDATE USING (public.is_admin_user(auth.uid()));

-- Feedback history: residents read history of their own feedback; admins read all
DROP POLICY IF EXISTS "Residents can view own feedback history" ON public.feedback_status_history;
DROP POLICY IF EXISTS "Admins can view all feedback history" ON public.feedback_status_history;
CREATE POLICY "Residents can view own feedback history" ON public.feedback_status_history
  FOR SELECT USING (
    feedback_id IN (
      SELECT f.id FROM public.feedback f
      WHERE f.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "Admins can view all feedback history" ON public.feedback_status_history
  FOR SELECT USING (public.is_admin_user(auth.uid()));

-- Request status history: residents read history of their own requests; admins read all
DROP POLICY IF EXISTS "Residents can view own request history" ON public.request_status_history;
DROP POLICY IF EXISTS "Admins can view all request history" ON public.request_status_history;
CREATE POLICY "Residents can view own request history" ON public.request_status_history
  FOR SELECT USING (
    request_id IN (
      SELECT r.id FROM public.requests r
      WHERE r.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "Admins can view all request history" ON public.request_status_history
  FOR SELECT USING (public.is_admin_user(auth.uid()));

-- Complaint status history: residents read history of their own complaints; admins read all
DROP POLICY IF EXISTS "Residents can view own complaint history" ON public.complaint_status_history;
DROP POLICY IF EXISTS "Admins can view all complaint history" ON public.complaint_status_history;
CREATE POLICY "Residents can view own complaint history" ON public.complaint_status_history
  FOR SELECT USING (
    complaint_id IN (
      SELECT c.id FROM public.complaints c
      WHERE c.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "Admins can view all complaint history" ON public.complaint_status_history
  FOR SELECT USING (public.is_admin_user(auth.uid()));

-- ============================================================================
-- 7. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS offices_active_idx ON public.offices(is_active, sort_order);
CREATE INDEX IF NOT EXISTS service_categories_office_idx ON public.service_categories(office_key);
CREATE INDEX IF NOT EXISTS service_categories_directory_idx ON public.service_categories(directory_category, is_active);
CREATE INDEX IF NOT EXISTS service_steps_service_idx ON public.service_steps(service_category_id, step_number);
CREATE INDEX IF NOT EXISTS feedback_resident_idx ON public.feedback(resident_id);
CREATE INDEX IF NOT EXISTS feedback_status_idx ON public.feedback(status);
CREATE INDEX IF NOT EXISTS feedback_status_history_feedback_idx ON public.feedback_status_history(feedback_id, created_at);
CREATE INDEX IF NOT EXISTS request_status_history_request_idx ON public.request_status_history(request_id, created_at);
CREATE INDEX IF NOT EXISTS complaint_status_history_complaint_idx ON public.complaint_status_history(complaint_id, created_at);


DROP TRIGGER IF EXISTS trg_log_feedback_status_change ON public.feedback;
CREATE TRIGGER trg_log_feedback_status_change
  AFTER INSERT OR UPDATE OF status ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.log_feedback_status_change();

