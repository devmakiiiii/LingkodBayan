
-- Run this script FIRST to set up the database schema with correct RLS policies
-- This is a consolidated version with the INSERT policy fix included

-- Create residents table
CREATE TABLE IF NOT EXISTS public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  barangay TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create requests table (for services)
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'other-services',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  evidence_url TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_address TEXT,
  priority_level TEXT DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
  assigned_official_id UUID,
  admin_notes TEXT,
  archived_at TIMESTAMP WITH TIME ZONE,
  tracking_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create designations table
CREATE TABLE IF NOT EXISTS public.designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('barangay', 'sk', 'staff')),
  priority_order INTEGER NOT NULL DEFAULT 999,
  badge_color TEXT NOT NULL DEFAULT '#28A745',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT designations_name_unique UNIQUE (name, category)
);

-- Create officials table
CREATE TABLE IF NOT EXISTS public.officials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  designation_id UUID NOT NULL REFERENCES public.designations(id) ON DELETE RESTRICT,
  contact_number TEXT,
  email TEXT,
  term_start DATE,
  term_end DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officials ENABLE ROW LEVEL SECURITY;

-- Helper functions that bypass RLS recursion when checking admin membership
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
  OR coalesce((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin'), false)
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
  OR coalesce((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin', false)
  OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false);
$$;

-- RLS Policies for residents table (FIXED - includes INSERT policy)
DROP POLICY IF EXISTS "Residents can view their own data" ON public.residents;
DROP POLICY IF EXISTS "Residents can create their own profile" ON public.residents;
DROP POLICY IF EXISTS "Residents can update their own data" ON public.residents;
DROP POLICY IF EXISTS "Admins can view all residents" ON public.residents;
DROP POLICY IF EXISTS "Admins can update resident data" ON public.residents;

CREATE POLICY "Residents can view their own data" ON public.residents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Residents can create their own profile" ON public.residents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Residents can update their own data" ON public.residents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all residents" ON public.residents
  FOR SELECT USING (
    public.is_admin_user(auth.uid())
  );

CREATE POLICY "Admins can update resident data" ON public.residents
  FOR UPDATE USING (
    public.is_admin_user(auth.uid())
  );

-- RLS Policies for requests table
DROP POLICY IF EXISTS "Residents can view their own requests" ON public.requests;
DROP POLICY IF EXISTS "Residents can create requests" ON public.requests;
DROP POLICY IF EXISTS "Residents can update their own requests" ON public.requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.requests;

CREATE POLICY "Residents can view their own requests" ON public.requests
  FOR SELECT USING (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );

CREATE POLICY "Residents can create requests" ON public.requests
  FOR INSERT WITH CHECK (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );

CREATE POLICY "Residents can update their own requests" ON public.requests
  FOR UPDATE USING (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all requests" ON public.requests
  FOR SELECT USING (
    public.is_admin_user(auth.uid())
  );

CREATE POLICY "Admins can update requests" ON public.requests
  FOR UPDATE USING (
    public.is_admin_user(auth.uid())
  );

-- RLS Policies for complaints table
DROP POLICY IF EXISTS "Residents can view their own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Residents can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "Residents can update their own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;

CREATE POLICY "Residents can view their own complaints" ON public.complaints
  FOR SELECT USING (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );

CREATE POLICY "Residents can create complaints" ON public.complaints
  FOR INSERT WITH CHECK (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );

CREATE POLICY "Residents can update their own complaints" ON public.complaints
  FOR UPDATE USING (
    resident_id IN (
      SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all complaints" ON public.complaints
  FOR SELECT USING (
    public.is_admin_user(auth.uid())
  );

CREATE POLICY "Admins can update complaints" ON public.complaints
  FOR UPDATE USING (
    public.is_admin_user(auth.uid())
  );

-- RLS Policies for announcements table
DROP POLICY IF EXISTS "Anyone can view published announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;

CREATE POLICY "Anyone can view published announcements" ON public.announcements
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Admins can manage announcements" ON public.announcements
  FOR ALL USING (
    public.is_admin_user(auth.uid())
  );

-- RLS Policies for admin_users table
DROP POLICY IF EXISTS "Admins can view admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Only super admins can manage admin users" ON public.admin_users;

CREATE POLICY "Admins can view admin users" ON public.admin_users
  FOR SELECT USING (
    public.is_admin_user(auth.uid())
  );

CREATE POLICY "Only super admins can manage admin users" ON public.admin_users
  FOR ALL USING (
    public.is_super_admin_user(auth.uid())
  );
--- Migration 02: Add Geolocation & Complaint Messages ---
-- Add geolocation fields to complaints table
ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Create complaint messages table for Reply feature
CREATE TABLE IF NOT EXISTS public.complaint_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'reply', -- reply, system, action
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.complaint_messages
ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.complaint_messages
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.complaint_messages
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Deployments whose complaint_messages table already existed skip the CREATE
-- TABLE above, so message_type has to be added explicitly here: the reply and
-- activity flows write 'reply' / 'system' rows
-- (see components/admin/resident-reports-page.tsx).
ALTER TABLE public.complaint_messages
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'reply';

-- Projects whose complaint_messages table was created by an earlier revision
-- carry a NOT NULL sender_type that neither reply flow writes
-- (see components/admin/resident-reports-page.tsx and
-- app/api/citizen/complaint-reply/route.ts), which would reject every insert.
-- The column is left in place for readers of the older schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaint_messages'
      AND column_name = 'sender_type'
  ) THEN
    ALTER TABLE public.complaint_messages ALTER COLUMN sender_type DROP NOT NULL;
  END IF;
END
$$;

-- Serves the unread-notification queries issued by the citizen dashboard,
-- the notifications page, and the notification badge.
CREATE INDEX IF NOT EXISTS complaint_messages_recipient_unread_idx
  ON public.complaint_messages (recipient_user_id, is_read);

-- Enable RLS on complaint_messages
ALTER TABLE public.complaint_messages ENABLE ROW LEVEL SECURITY;

-- Helper functions that bypass RLS recursion when checking admin membership
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
  OR coalesce((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin'), false)
  OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'), false);
$$;

-- RLS Policies for complaint_messages
DROP POLICY IF EXISTS "Users can view messages for their complaints" ON public.complaint_messages;
DROP POLICY IF EXISTS "Users can create messages for their complaints" ON public.complaint_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.complaint_messages;
DROP POLICY IF EXISTS "Admins can create messages" ON public.complaint_messages;

CREATE POLICY "Users can view messages for their complaints" ON public.complaint_messages
  FOR SELECT USING (
    recipient_user_id = auth.uid()
    OR
    complaint_id IN (
      SELECT complaints.id FROM public.complaints 
      WHERE complaints.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
    OR
    sender_id = auth.uid()
  );

-- A resident replying to the barangay has no single recipient account, so
-- recipient_user_id is deliberately left NULL on those rows
-- (see app/api/citizen/complaint-reply/route.ts). Staff still see the thread
-- through the "Admins can view all messages" policy, which is why the insert
-- policy only has to prove thread ownership and authorship.
CREATE POLICY "Users can create messages for their complaints" ON public.complaint_messages
  FOR INSERT WITH CHECK (
    complaint_id IN (
      SELECT complaints.id FROM public.complaints 
      WHERE complaints.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
    AND sender_id = auth.uid()
  );

CREATE POLICY "Admins can view all messages" ON public.complaint_messages
  FOR SELECT USING (
    public.is_admin_user(auth.uid())
  );

CREATE POLICY "Admins can create messages" ON public.complaint_messages
  FOR INSERT WITH CHECK (
    public.is_admin_user(auth.uid())
  );

UPDATE public.complaint_messages cm
SET recipient_user_id = r.user_id
FROM public.complaints c
JOIN public.residents r ON r.id = c.resident_id
WHERE cm.complaint_id = c.id
  AND cm.recipient_user_id IS NULL;

DROP POLICY IF EXISTS "Users can update their complaint messages" ON public.complaint_messages;

CREATE POLICY "Users can update their complaint messages" ON public.complaint_messages
  FOR UPDATE USING (
    recipient_user_id = auth.uid()
    OR
    sender_id = auth.uid()
    OR complaint_id IN (
      SELECT complaints.id FROM public.complaints
      WHERE complaints.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
    OR
    sender_id = auth.uid()
    OR complaint_id IN (
      SELECT complaints.id FROM public.complaints
      WHERE complaints.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
  );

-- Update complaints status enum
-- Add new status values if not exists
-- Status values: open, under_investigation, resolved, dismissed

--- Migration 03: Fix Residents RLS (Insert Policy) ---
-- Add missing INSERT policy for residents table
-- This allows users to create their own resident profile during signup
-- Only run if the functions don't exist yet

-- Helper functions that bypass RLS recursion when checking admin membership
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
  OR coalesce((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin'), false)
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
  OR coalesce((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin', false)
  OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false);
$$;

-- Add INSERT policy for residents table
-- This is the CRITICAL fix for the dashboard error
DROP POLICY IF EXISTS "Residents can create their own profile" ON public.residents;

CREATE POLICY "Residents can create their own profile" ON public.residents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
--- Migration 04: Add Request Payload ---
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'other-services';

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.requests
SET payload = CASE
  WHEN payload IS NULL OR payload = '{}'::jsonb THEN jsonb_build_object(
    'legacyTitle', title,
    'legacyDescription', description,
    'legacyCategory', category
  )
  ELSE payload
END
WHERE TRUE;

UPDATE public.requests
SET request_type = COALESCE(NULLIF(request_type, ''), category, 'other-services')
WHERE TRUE;

--- Migration 05: Officials & Designations (tables + RLS policies) ---
CREATE TABLE IF NOT EXISTS public.designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('barangay', 'sk', 'staff')),
  priority_order INTEGER NOT NULL DEFAULT 999,
  badge_color TEXT NOT NULL DEFAULT '#28A745',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT designations_name_unique UNIQUE (name, category)
);

CREATE TABLE IF NOT EXISTS public.officials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  designation_id UUID NOT NULL REFERENCES public.designations(id) ON DELETE RESTRICT,
  contact_number TEXT,
  email TEXT,
  term_start DATE,
  term_end DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view designations" ON public.designations;
DROP POLICY IF EXISTS "Admins can manage designations" ON public.designations;
DROP POLICY IF EXISTS "Admins can view officials" ON public.officials;
DROP POLICY IF EXISTS "Admins can manage officials" ON public.officials;

CREATE POLICY "Admins can view designations" ON public.designations
  FOR SELECT USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can manage designations" ON public.designations
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can view officials" ON public.officials
  FOR SELECT USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can manage officials" ON public.officials
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE INDEX IF NOT EXISTS designations_priority_order_idx ON public.designations(priority_order ASC, name ASC);
CREATE INDEX IF NOT EXISTS officials_designation_id_idx ON public.officials(designation_id);
CREATE INDEX IF NOT EXISTS officials_status_idx ON public.officials(status);

--- Migration 06: System Settings & Service Categories ---
-- Create system_settings table for global barangay metadata
CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT valid_setting_key CHECK (setting_key ~ '^[a-z_]+$')
);

-- Create service_categories table
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  title TEXT NOT NULL,
  description TEXT,
  category_type TEXT NOT NULL CHECK (category_type IN ('document', 'appointment', 'incident')),
  sort_order INTEGER NOT NULL DEFAULT 999,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT service_categories_unique_type_slug UNIQUE (category_type, slug)
);

-- Create request_types table to allow admin-managed request catalog
CREATE TABLE IF NOT EXISTS public.request_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  title TEXT NOT NULL,
  service_category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  summary_field TEXT,
  form_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 999,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create service_category_requirements junction table for document type requirements (valid ID, Cedula, etc.)
CREATE TABLE IF NOT EXISTS public.service_category_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  requirement_key TEXT NOT NULL CHECK (requirement_key ~ '^[a-z_]+$'),
  requirement_label TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 999,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT service_category_requirements_unique UNIQUE (service_category_id, requirement_key)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_category_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_settings
DROP POLICY IF EXISTS "Admins can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can view system settings" ON public.system_settings
  FOR SELECT USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admins can manage system settings" ON public.system_settings
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- RLS Policies for service_categories (anyone can read active, admins can manage all)
DROP POLICY IF EXISTS "Anyone can view active service categories" ON public.service_categories;
DROP POLICY IF EXISTS "Admins can view all service categories" ON public.service_categories;
DROP POLICY IF EXISTS "Admins can manage service categories" ON public.service_categories;
CREATE POLICY "Anyone can view active service categories" ON public.service_categories
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can view all service categories" ON public.service_categories
  FOR SELECT USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admins can manage service categories" ON public.service_categories
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- RLS Policies for request_types
DROP POLICY IF EXISTS "Anyone can view active request types" ON public.request_types;
DROP POLICY IF EXISTS "Admins can view all request types" ON public.request_types;
DROP POLICY IF EXISTS "Admins can manage request types" ON public.request_types;
CREATE POLICY "Anyone can view active request types" ON public.request_types
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can view all request types" ON public.request_types
  FOR SELECT USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Admins can manage request types" ON public.request_types
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- RLS Policies for service_category_requirements
DROP POLICY IF EXISTS "Admins can manage service category requirements" ON public.service_category_requirements;
CREATE POLICY "Admins can manage service category requirements" ON public.service_category_requirements
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS system_settings_key_idx ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS service_categories_type_active_idx ON public.service_categories(category_type, is_active);
CREATE INDEX IF NOT EXISTS service_categories_sort_idx ON public.service_categories(sort_order ASC);
CREATE INDEX IF NOT EXISTS request_types_active_idx ON public.request_types(is_active);
CREATE INDEX IF NOT EXISTS request_types_category_idx ON public.request_types(service_category_id);
CREATE INDEX IF NOT EXISTS service_category_requirements_category_idx ON public.service_category_requirements(service_category_id);

--- Migration 07: Seed Service Categories ---
-- Seed initial service categories to match hardcoded values
-- Run this after 06_add_system_settings.sql

-- Document categories (services)
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active)
VALUES
  ('barangay-clearance', 'Barangay Clearance', 'Official document required for various transactions, confirming local residency in good standing.', 'document', 1, true),
  ('certificate-residency', 'Certificate of Residency', 'A legal document certifying that a citizen is a permanent resident of the barangay.', 'document', 2, true),
  ('business-permit', 'Business Permit', 'For new applications and renewals of local businesses.', 'document', 3, true),
  ('good-moral', 'Good Moral Certificate', 'Certifies good character, commonly required for school or employment.', 'document', 4, true),
  ('indigency', 'Indigency Certificate', 'Required for welfare benefits, scholarships, and assistance programs.', 'document', 5, true)
ON CONFLICT (slug) DO NOTHING;

-- Incident/complaint categories - used for File Complaint page
-- (Filtered out from Request Service to avoid user confusion)
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active)
VALUES
  ('noise-complaint', 'Noise Complaint', 'Report excessive noise disturbances in the community.', 'incident', 1, true),
  ('public-disturbance', 'Public Disturbance', 'Reports regarding disputes, fights, or disturbances in public areas.', 'incident', 2, true),
  ('sanitation', 'Sanitation', 'Issues related to garbage collection, waste management, and cleanliness.', 'incident', 3, true),
  ('infrastructure-issue', 'Infrastructure Issue', 'Concerns about road repairs, street conditions, and public facilities.', 'incident', 4, true),
  ('barangay-incident', 'Barangay Incident', 'Serious incidents including assault, theft, and other safety concerns.', 'incident', 5, true),
  ('illegal-parking', 'Illegal Parking', 'Reports of vehicles blocking roads, driveways, or public spaces.', 'incident', 6, true),
  ('street-light-problem', 'Street Light Problem', 'Issues with street lighting and dark areas in the community.', 'incident', 7, true),
  ('other-concerns', 'Other Concerns', 'General concerns not covered by other categories.', 'incident', 8, true)
ON CONFLICT (slug) DO NOTHING;
--- Migration 11: Add Resident Report Fields ---
ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS priority_level TEXT DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS assigned_official_id UUID REFERENCES public.officials(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

CREATE INDEX IF NOT EXISTS complaints_priority_level_idx ON public.complaints(priority_level);
CREATE INDEX IF NOT EXISTS complaints_assigned_official_id_idx ON public.complaints(assigned_official_id);

UPDATE public.complaints
SET tracking_number = COALESCE(tracking_number, 'RPT-' || UPPER(SUBSTRING(id::text, 1, 8)))
WHERE tracking_number IS NULL;
--- Migration 12: Fix Admin Update Complaints & Messages ---
-- Fix: Admins unable to update complaints and send replies
-- The existing policies may be missing WITH CHECK clauses,
-- which causes Supabase to silently block writes and return errors.

-- 1. Fix admin UPDATE policy for complaints
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;

CREATE POLICY "Admins can update complaints" ON public.complaints
  FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- 2. Fix admin INSERT policy for complaint_messages (for sending replies)
DROP POLICY IF EXISTS "Admins can create messages" ON public.complaint_messages;

CREATE POLICY "Admins can create messages" ON public.complaint_messages
  FOR INSERT
  WITH CHECK (public.is_admin_user(auth.uid()));

-- 3. Fix admin UPDATE policy for complaint_messages (mark as read, etc.)
DROP POLICY IF EXISTS "Admins can update messages" ON public.complaint_messages;

CREATE POLICY "Admins can update messages" ON public.complaint_messages
  FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

--- Migration 13: Add Evidence URL to Complaints ---
-- Add evidence_url to complaints table
ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS evidence_url TEXT;

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Allow anyone to read (public bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public read access for evidence bucket'
  ) THEN
    CREATE POLICY "Public read access for evidence bucket"
    ON storage.objects FOR SELECT
    TO public
    USING ( bucket_id = 'evidence' );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload evidence'
  ) THEN
    CREATE POLICY "Authenticated users can upload evidence"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'evidence' );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own evidence'
  ) THEN
    CREATE POLICY "Users can delete their own evidence"
    ON storage.objects FOR DELETE
    TO authenticated
    USING ( bucket_id = 'evidence' AND auth.uid() = owner );
  END IF;
END
$$;

--- Migration 14: Add Image URL & Excerpt to Announcements ---
-- Add image_url and excerpt columns to announcements table
-- These columns are referenced by the announcements feature but may be missing in existing databases

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS excerpt TEXT;

-- Add comments explaining the columns
COMMENT ON COLUMN public.announcements.image_url IS 'Optional image URL for announcement banner/image';
COMMENT ON COLUMN public.announcements.excerpt IS 'Optional short summary/preview text for announcement cards';
--- Migration 15: Add Excerpt to Announcements (idempotent) ---
-- Add excerpt column to announcements table
-- This column provides a short summary for announcement previews

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS excerpt TEXT;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.announcements.excerpt IS 'Optional short summary/preview text for announcement cards';
--- Migration 16: Verification Schema ---
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

--- Migration 17: ID Documents Storage Bucket ---
-- Migration 17: Create ID documents storage bucket
-- Private bucket for identity document uploads (PII-sensitive)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('id-documents', 'id-documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies live on storage.objects as RLS policies (there is no
-- storage.policy table on current Supabase). Object paths are "<uid>/<file>",
-- so (storage.foldername(name))[1] identifies the owning resident.

-- Only admins can read other residents' id-documents; residents can read
-- their own folder.
DROP POLICY IF EXISTS "Admin can read id documents" ON storage.objects;
CREATE POLICY "Admin can read id documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'id-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );

-- Residents can upload only to their own folder.
DROP POLICY IF EXISTS "Residents can upload id documents to their own folder" ON storage.objects;
CREATE POLICY "Residents can upload id documents to their own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Residents can read their own id documents.
DROP POLICY IF EXISTS "Residents can read their own id documents" ON storage.objects;
CREATE POLICY "Residents can read their own id documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

--- Migration 17b: Announcement Images Storage Bucket ---
-- Create the announcement-images storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-images', 'announcement-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS is already enabled on storage.objects (it is owned by the internal
-- supabase_storage_admin role, so ALTER TABLE on it is not permitted here).
-- Add RLS policies for announcement-images bucket (needed for file uploads)
DROP POLICY IF EXISTS "Public read access for announcement-images bucket" ON storage.objects;
CREATE POLICY "Public read access for announcement-images bucket"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'announcement-images');

DROP POLICY IF EXISTS "Authenticated users can upload announcement-images" ON storage.objects;
CREATE POLICY "Authenticated users can upload announcement-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'announcement-images');

DROP POLICY IF EXISTS "Users can delete their own announcement-images" ON storage.objects;
CREATE POLICY "Users can delete their own announcement-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'announcement-images' AND auth.uid() = owner);
--- Migration 18: Add Archived Status to Officials ---
-- Migration 18: Add 'archived' status to officials table
-- Allows soft-deleting (archiving) officials instead of hard-deleting them.

ALTER TABLE public.officials
  DROP CONSTRAINT IF EXISTS officials_status_check;

ALTER TABLE public.officials
  ADD CONSTRAINT officials_status_check
  CHECK (status IN ('active', 'inactive', 'archived'));

--- Migration 19: Add Date of Birth to Residents ---
-- Migration 19: Add date_of_birth column to residents table
-- Adds date_of_birth DATE column to store resident's date of birth

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE INDEX IF NOT EXISTS idx_residents_date_of_birth ON public.residents (date_of_birth);
--- Migration 20: Audit Logs ---
-- Migration 20: Create audit_logs table
-- Records admin activity (who did what, when, and what changed) for the
-- Audit Trail Report on the admin Generated Reports page.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  admin_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_admin_id_idx ON public.audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_type_idx ON public.audit_logs (resource_type);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies are granted to anon or authenticated
-- roles on purpose: audit logs are written and read exclusively through
-- server-side API routes using the Supabase service role key, which bypasses RLS.

--- Finalize Complaints Schema ---
-- Post-setup: Configure evidence storage bucket and policies
-- This script adds the storage bucket configuration for file uploads

-- Create the evidence storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for evidence bucket (needed for file uploads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public read access for evidence bucket'
  ) THEN
    CREATE POLICY "Public read access for evidence bucket"
    ON storage.objects FOR SELECT
    TO public
    USING ( bucket_id = 'evidence' );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload evidence'
  ) THEN
    CREATE POLICY "Authenticated users can upload evidence"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'evidence' );
  END IF;
END
$$;

-- Update existing complaints with tracking numbers if missing
UPDATE public.complaints
SET tracking_number = COALESCE(tracking_number, 'RPT-' || UPPER(SUBSTRING(id::text, 1, 8)))
WHERE tracking_number IS NULL;

