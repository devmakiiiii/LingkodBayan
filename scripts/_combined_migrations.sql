
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

--- Migration 21: Assign Officials to Requests (workload balancing) ---
-- Allow service requests to be assigned to barangay officials so workload
-- balancing covers both complaints and requests (complaints already have
-- assigned_official_id via migration 11).
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS assigned_official_id UUID REFERENCES public.officials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS requests_assigned_official_id_idx ON public.requests(assigned_official_id);

--- Migration 22: Citizen's Charter 2025 Schema Extensions ---
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


--- Migration 23: Seed Citizen's Charter 2025 Data ---
-- Migration 23: Seed Barangay Barretto Citizen's Charter 2025 (1st Edition) data
-- Source of truth: Barangay Barretto Citizen's Charter 2025 - 1st Edition.
-- All services, fees, requirements, processing times, offices, and steps below
-- are taken directly from the charter. Nothing is invented.
-- Idempotent: safe to run multiple times (upserts + delete-then-insert children).

-- ============================================================================
-- 1. OFFICES (Charter Section 20)
-- ============================================================================
INSERT INTO public.offices (office_key, name, charter_category, address, phone, email, facebook, sort_order, is_active)
VALUES
  ('punong-barangay', 'Office of the Punong Barangay', 'Office of the Punong Barangay',
   '#3 Ilo-Ilo Street, Barretto, Olongapo City', '222-1451 / 222-4295', NULL, NULL, 1, TRUE),
  ('secretariat', 'Office of the Secretary', 'Secretariat Office',
   '#3 Ilo-Ilo Street, Barretto, Olongapo City', '222-1451 / 222-4295', 'barangaybarretto00@gmail.com', NULL, 2, TRUE),
  ('treasury', 'Treasury Office', 'Treasury Office',
   '#3 Ilo-Ilo Street, Barretto, Olongapo City', '222-1451', NULL, NULL, 3, TRUE),
  ('lupon', 'Lupong Tagapamayapa', 'Lupong Tagapamayapa / Barangay Justice System',
   NULL, NULL, NULL, NULL, 4, TRUE),
  ('command-center', 'Command Center', 'Command Center',
   NULL, NULL, NULL, NULL, 5, TRUE),
  ('health-center', 'Barangay Health Center', 'Barangay Health Center',
   '#2 Ilo-Ilo Street, Barretto, Olongapo City', NULL, NULL, 'Barangay Barretto Health Center', 6, TRUE),
  ('bbfru', 'Barangay Barretto Fire and Rescue Unit (BBFRU)', 'Barangay Barretto Fire and Rescue Unit (BBFRU)',
   '#2 Ilo-Ilo Street, Barretto, Olongapo City', '0946-214-2438', NULL, NULL, 7, TRUE),
  ('bpat', 'Barretto Peacekeeping Action Team (BPAT)', 'Barretto Peacekeeping Action Team (BPAT)',
   '#2 Ilo-Ilo Street, Barretto, Olongapo City', '0938-949-5840', NULL, NULL, 8, TRUE),
  ('cdc', 'Day Care Center / Child Development Center (CDC)', 'Child Development Center (CDC)',
   '#2 Ilo-Ilo Street, Barretto, Olongapo City', '0915-165-3902', NULL, NULL, 9, TRUE),
  ('bblc', 'Barangay Barretto Learning Center (BBLC)', 'Community-Based Learning and Literacy Program / BBLC',
   '#3 Ilo-Ilo Street, Barretto, Olongapo City', '222-4295', NULL, NULL, 10, TRUE)
ON CONFLICT (office_key) DO UPDATE SET
  name = EXCLUDED.name,
  charter_category = EXCLUDED.charter_category,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  facebook = EXCLUDED.facebook,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================================================
-- 2. CHARTER SERVICES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2a. TREASURY OFFICE (Charter Section 7) - Classification: Simple - G2C/G2B/G2G - Who may avail: All
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('record-clearance', 'Record Clearance',
   'Clearance issued by the Treasury Office based on barangay records.',
   'document', 10, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'range', 50, 60, '₱50–₱60',
   '5–10 minutes', 'Secretariat Encoder', 'Treasury Office', 'documents-certifications'),
  ('cedula-community-tax-certificate', 'Cedula / Community Tax Certificate',
   'Community Tax Certificate issued based on declared income.',
   'document', 11, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'formula', 5, NULL, '₱5.00 base + ₱1.00 per ₱1,000 income',
   '15 minutes', 'Treasurer / Revenue Collector', 'Treasury Office', 'documents-certifications'),
  ('business-endorsement', 'Business Endorsement',
   'Barangay endorsement for businesses with DTI Business Registration.',
   'document', 12, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'free', 0, 0, 'None',
   '5 minutes', 'Secretariat Encoder', 'Treasury Office', 'business-property'),
  ('lot-certification-building-renovation', 'Lot Certification for Building/Renovation Clearance',
   'Certification for building or renovation clearance; includes an inspection.',
   'document', 13, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'range', 200, 300, '₱200–₱300',
   '3 working days', 'Secretariat Encoder / Kagawad Committee on Land Matters', 'Treasury Office', 'business-property'),
  ('franchise-clearance', 'Franchise Clearance',
   'Clearance for vehicle franchises based on OR/CR.',
   'document', 14, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'fixed', 150, 150, '₱150',
   '10 minutes', 'Secretariat Encoder', 'Treasury Office', 'business-property'),
  ('motor-banca-clearance', 'Motor Banca Clearance',
   'Clearance for motor bancas operating within the barangay.',
   'document', 15, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'fixed', 200, 200, '₱200',
   '10 minutes', 'Secretariat Encoder', 'Treasury Office', 'business-property')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2b. SECRETARIAT OFFICE (Charter Section 8) - Classification: Simple - G2C/G2B/G2G
--     Note: 'indigency' and 'certificate-residency' already exist; enriched here.
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('indigency', 'Certificate of Indigency',
   'Certifies that the applicant is indigent; for residents of Barangay Barretto.',
   'document', 5, TRUE,
   'secretariat', 'simple', ARRAY['G2C','G2B','G2G'], 'Residents of Barangay Barretto',
   'free', 0, 0, 'None',
   '5 minutes', 'Secretariat Clerk', 'Secretariat Office', 'documents-certifications'),
  ('certificate-residency', 'Certificate of Residency',
   'Certifies that the applicant is a resident of Barangay Barretto.',
   'document', 2, TRUE,
   'secretariat', 'simple', ARRAY['G2C','G2B','G2G'], 'Residents of Barangay Barretto',
   'range', 50, 60, '₱50–₱60',
   '5 minutes', 'Secretariat Clerk', 'Secretariat Office', 'documents-certifications'),
  ('certificate-of-actual-occupancy', 'Certificate of Actual Occupancy',
   'Certifies actual occupancy of a lot; for Power Line, Water Line, or Tax Declaration purposes.',
   'document', 7, TRUE,
   'secretariat', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'fixed', 50, 50, '₱50',
   '5–10 minutes', 'Secretariat Clerk', 'Secretariat Office', 'business-property'),
  ('first-time-job-seeker-certification', 'First-Time Job Seeker Certification',
   'Certification for first-time job seekers; for residents of Barangay Barretto.',
   'document', 8, TRUE,
   'secretariat', 'simple', ARRAY['G2C','G2B','G2G'], 'Residents of Barangay Barretto',
   'free', 0, 0, 'None',
   '5–10 minutes', 'Secretariat Clerk', 'Secretariat Office', 'documents-certifications')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2c. LUPONG TAGAPAMAYAPA / BARANGAY JUSTICE SYSTEM (Charter Section 9)
--     Highly Technical Transaction - G2C
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('lupon-dispute-settlement', 'Lupong Tagapamayapa Dispute Settlement',
   'Settles community disputes peacefully and outside court through mediation and conciliation (Katarungang Pambarangay).',
   'justice', 20, TRUE,
   'lupon', 'highly_technical', ARRAY['G2C'], 'Residents of the same barangay or adjacent barangays (Section 412, RA 7160)',
   'per_page', 50, NULL, '₱50 for the first three pages; ₱5 for every succeeding page',
   'Approximately 45 days and 10 minutes', 'Punong Barangay / Lupong Tagapamayapa', 'Lupong Tagapamayapa / Barangay Justice System', 'peace-security')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2d. COMMAND CENTER (Charter Section 10) - Classification: Simple - G2C
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('cctv-footage-access', 'CCTV Footage Access Request',
   'Request access to CCTV footage for investigation or incident review through the Command Center.',
   'document', 21, TRUE,
   'command-center', 'simple', ARRAY['G2C'], 'Residents or authorized personnel needing access to CCTV footage for investigation or incident review',
   'free', 0, 0, 'None',
   '10 minutes', 'Punong Barangay / Barangay Staff', 'Command Center', 'peace-security')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2e. BARANGAY HEALTH CENTER (Charter Section 11) - All services free of charge
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('medical-consultation-medicine', 'Medical Consultation and Dispensing of Medicine',
   'Medical consultation with prescription and dispensing of available medicine.',
   'health', 30, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   '35 minutes (total)', 'Barangay Health Worker / RHU Doctor / Nurse / Health Staff', 'Barangay Health Center', 'health'),
  ('immunization-for-children', 'Immunization for Children',
   'Routine immunization for children, with growth check and immunization record updates.',
   'health', 31, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   '25 minutes (total)', NULL, 'Barangay Health Center', 'health'),
  ('maternal-care-prenatal-checkup', 'Maternal Care and Prenatal Check-Up',
   'Prenatal check-up with physical examination, supplements, and health advice for pregnant mothers.',
   'health', 32, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   '35 minutes (total)', NULL, 'Barangay Health Center', 'health'),
  ('family-planning', 'Family Planning',
   'Counseling, family planning education, contraceptive methods (pills, condoms, injectables), and responsible parenthood information.',
   'health', 33, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   NULL, NULL, 'Barangay Health Center', 'health'),
  ('tb-screening-treatment', 'Tuberculosis (TB) Screening and Treatment',
   'TB screening, sputum testing, and enrollment in DOTS with regular monitoring and medicine supervision.',
   'health', 34, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   'Approximately 3 days and 30 minutes, with ongoing weekly/monthly monitoring where applicable', NULL, 'Barangay Health Center', 'health'),
  ('minor-treatment-first-aid', 'Minor Treatment and First Aid',
   'Treatment for cuts, burns, bruises, fever, sprains, and other minor injuries or issues.',
   'health', 35, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   '20 minutes', NULL, 'Barangay Health Center', 'health')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2f. BARANGAY BARRETTO FIRE AND RESCUE UNIT - BBFRU (Charter Sections 12-14)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('emergency-response-fire-rescue', 'Emergency Response (Fire, Rescue, Disaster)',
   'Fire suppression, rescue operations, and disaster response by the official emergency response team of Barangay Barretto.',
   'emergency', 40, TRUE,
   'bbfru', 'simple', ARRAY['G2C'], 'Any person or establishment within Barangay Barretto, Olongapo City',
   'free', 0, 0, 'None',
   'Response begins immediately', NULL, 'Barangay Barretto Fire and Rescue Unit (BBFRU)', 'emergency-rescue'),
  ('basic-life-support-training', 'Basic Life Support (BLS) Training',
   'Training on CPR, wound care, stabilization, basic first aid, and emergency response, with certificate of participation.',
   'program', 41, TRUE,
   'bbfru', 'simple', ARRAY['G2C'], 'Residents, students, barangay personnel, and interested individuals/groups within Barangay Barretto',
   'free', 0, 0, 'None',
   'Approximately 4 days and 35 minutes', NULL, 'Basic Life Support (BLS)', 'emergency-rescue'),
  ('tree-cutting-animal-rescue', 'Tree Cutting / Animal Rescue Assistance',
   'Assistance for fallen trees, hazardous branches, and trapped or endangered animals.',
   'emergency', 42, TRUE,
   'bbfru', 'simple', ARRAY['G2C'], 'Any person or establishment within Barangay Barretto, Olongapo City',
   'free', 0, 0, 'None',
   NULL, NULL, 'Tree Cutting / Animal Rescue Assistance', 'emergency-rescue')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2g. BARRETTO PEACEKEEPING ACTION TEAM - BPAT (Charter Section 15)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('bpat-peacekeeping-assistance', 'Peacekeeping Assistance (BPAT)',
   'Report concerns or suspicious activity; BPAT helps maintain peace, order, and public safety.',
   'emergency', 50, TRUE,
   'bpat', 'simple', ARRAY['G2C'], 'Residents, business owners, and visitors within Barangay Barretto',
   'free', 0, 0, 'None',
   'Approximately 45 minutes, with immediate initial response', NULL, 'Barretto Peacekeeping Action Team (BPAT)', 'peace-security')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2h. CHILD DEVELOPMENT CENTER - CDC (Charter Section 16)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('cdc-enrollment', 'Child Development Center (CDC) Enrollment',
   'Early childhood care and development services addressing health, nutrition, early education, and social development for children aged 0–4 years.',
   'program', 60, TRUE,
   'cdc', 'simple', ARRAY['G2C'], 'Children aged 0–4 years (through a parent or guardian)',
   'free', 0, 0, 'None',
   NULL, NULL, 'Child Development Center (CDC)', 'child-development')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2i. COMMUNITY-BASED LEARNING AND LITERACY PROGRAM / BBLC (Charter Section 17)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('bblc-training-programs', 'BBLC Vocational Training and Literacy Programs',
   'TESDA-accredited vocational training and practical skills for employment and entrepreneurship; programs may include literacy, numeracy, livelihood, continuing education, and vocational training.',
   'program', 61, TRUE,
   'bblc', 'simple', ARRAY['G2C'], 'Out-of-school youth, adult learners, unemployed residents, and interested individuals in Barangay Barretto',
   'range', 1000, 5000, '₱1,000–₱5,000 depending on course',
   'Approximately 6 months, 15 days, and 45 minutes', NULL, 'Community-Based Learning and Literacy Program / BBLC', 'education-training')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ============================================================================
-- 3. REQUIREMENTS (exact labels from the charter checklists)
-- ============================================================================
DELETE FROM public.service_category_requirements
WHERE service_category_id IN (
  SELECT id FROM public.service_categories WHERE slug IN (
    'record-clearance','cedula-community-tax-certificate','business-endorsement',
    'lot-certification-building-renovation','franchise-clearance','motor-banca-clearance',
    'indigency','certificate-residency','certificate-of-actual-occupancy',
    'first-time-job-seeker-certification','lupon-dispute-settlement','cctv-footage-access',
    'medical-consultation-medicine','immunization-for-children','maternal-care-prenatal-checkup',
    'family-planning','tb-screening-treatment','minor-treatment-first-aid',
    'emergency-response-fire-rescue','basic-life-support-training','tree-cutting-animal-rescue',
    'bpat-peacekeeping-assistance','cdc-enrollment','bblc-training-programs'
  )
);

INSERT INTO public.service_category_requirements (service_category_id, requirement_key, requirement_label, is_required, sort_order)
SELECT c.id, r.requirement_key, r.requirement_label, r.is_required, r.sort_order
FROM public.service_categories c
JOIN (VALUES
  -- Treasury Office
  ('record-clearance', 'request_slip_or_valid_id', 'Request slip or valid government-issued ID', TRUE, 1),
  ('cedula-community-tax-certificate', 'valid_government_id', 'Valid government-issued ID', TRUE, 1),
  ('cedula-community-tax-certificate', 'source_of_income', 'Source of income or employer information', TRUE, 2),
  ('cedula-community-tax-certificate', 'estimated_gross_income', 'Estimated gross income (for self-employed/professionals)', TRUE, 3),
  ('business-endorsement', 'dti_business_registration', 'DTI Business Registration', TRUE, 1),
  ('lot-certification-building-renovation', 'waiver_of_rights_or_deed_of_sale', 'Waiver of Rights / Deed of Sale', TRUE, 1),
  ('lot-certification-building-renovation', 'tax_declaration_latest_payment', 'Tax Declaration with latest payment', TRUE, 2),
  ('lot-certification-building-renovation', 'lot_plan', 'Lot Plan', TRUE, 3),
  ('lot-certification-building-renovation', 'msa', 'MSA (Miscellaneous Sales Application)', TRUE, 4),
  ('franchise-clearance', 'or_cr_of_vehicle', 'OR/CR of vehicle', TRUE, 1),
  ('motor-banca-clearance', 'application', 'Application', TRUE, 1),
  ('motor-banca-clearance', 'supporting_documents', 'Supporting documents', TRUE, 2),
  ('motor-banca-clearance', 'motor_banca_specification', 'Specification of Motor Banca', TRUE, 3),
  -- Secretariat Office
  ('indigency', 'request_slip', 'Request Slip', TRUE, 1),
  ('indigency', 'residency', 'Must be a resident of Barangay Barretto', TRUE, 2),
  ('certificate-residency', 'request_slip', 'Request Slip', TRUE, 1),
  ('certificate-residency', 'residency', 'Must be a resident of Barangay Barretto', TRUE, 2),
  ('certificate-of-actual-occupancy', 'waiver_of_rights_or_deed_of_sale', 'Waiver of Rights / Deed of Sale', TRUE, 1),
  ('certificate-of-actual-occupancy', 'tax_declaration_latest_payment', 'Tax Declaration with latest payment', TRUE, 2),
  ('first-time-job-seeker-certification', 'ftjs_form', 'Duly accomplished FTJS Form', TRUE, 1),
  ('first-time-job-seeker-certification', 'residency', 'Must be a resident of Barangay Barretto', TRUE, 2)
) AS r(service_slug, requirement_key, requirement_label, is_required, sort_order)
  ON r.service_slug = c.slug;

INSERT INTO public.service_category_requirements (service_category_id, requirement_key, requirement_label, is_required, sort_order)
SELECT c.id, r.requirement_key, r.requirement_label, r.is_required, r.sort_order
FROM public.service_categories c
JOIN (VALUES
  -- Lupong Tagapamayapa
  ('lupon-dispute-settlement', 'written_complaint', 'Written Complaint', TRUE, 1),
  ('lupon-dispute-settlement', 'valid_government_id', 'Valid Government-Issued ID', TRUE, 2),
  ('lupon-dispute-settlement', 'barangay_certificate', 'Barangay Certificate', FALSE, 3),
  -- Command Center
  ('cctv-footage-access', 'police_or_bpat_blotter', 'Police or BPAT Blotter / Incident Report, if applicable', FALSE, 1),
  -- Barangay Health Center
  ('medical-consultation-medicine', 'philhealth_id', 'PhilHealth ID', TRUE, 1),
  ('medical-consultation-medicine', 'patient_health_record', 'Patient Health Record, if existing', FALSE, 2),
  ('immunization-for-children', 'child_birth_certificate_or_health_record', 'Child''s Birth Certificate or Health Record', TRUE, 1),
  ('immunization-for-children', 'immunization_card', 'Immunization Card, if applicable', FALSE, 2),
  ('maternal-care-prenatal-checkup', 'pregnant_mothers_health_record', 'Pregnant Mother''s Health Record', TRUE, 1),
  ('maternal-care-prenatal-checkup', 'philhealth_id', 'PhilHealth ID, if applicable', FALSE, 2),
  ('tb-screening-treatment', 'referral_form', 'Referral Form, if from RHU', FALSE, 1),
  ('tb-screening-treatment', 'philhealth_id', 'PhilHealth ID, if applicable', FALSE, 2),
  ('tb-screening-treatment', 'tb_sputum_test_result', 'TB Sputum Test Result, if available', FALSE, 3),
  ('minor-treatment-first-aid', 'patient_record', 'Patient Record, if on file', FALSE, 1)
) AS r(service_slug, requirement_key, requirement_label, is_required, sort_order)
  ON r.service_slug = c.slug;


INSERT INTO public.service_category_requirements (service_category_id, requirement_key, requirement_label, is_required, sort_order)
SELECT c.id, r.requirement_key, r.requirement_label, r.is_required, r.sort_order
FROM public.service_categories c
JOIN (VALUES
  -- BBFRU
  ('emergency-response-fire-rescue', 'exact_location', 'Exact location of incident', TRUE, 1),
  ('emergency-response-fire-rescue', 'nature_of_emergency', 'Nature of emergency (fire, trapped person, disaster, etc.)', TRUE, 2),
  ('emergency-response-fire-rescue', 'contact_information', 'Contact information', FALSE, 3),
  ('basic-life-support-training', 'letter_of_request_or_registration_form', 'Letter of request or registration form', TRUE, 1),
  ('basic-life-support-training', 'waiver_or_consent', 'Waiver or consent form, if required', FALSE, 2),
  ('tree-cutting-animal-rescue', 'exact_location', 'Exact location', TRUE, 1),
  ('tree-cutting-animal-rescue', 'situation_description', 'Description of situation', TRUE, 2),
  ('tree-cutting-animal-rescue', 'property_owner_consent', 'Property owner consent, if needed', FALSE, 3),
  -- BPAT
  ('bpat-peacekeeping-assistance', 'incident_details', 'Details of incident or concern', TRUE, 1),
  ('bpat-peacekeeping-assistance', 'location_and_description', 'Location and description of person/activity', TRUE, 2),
  ('bpat-peacekeeping-assistance', 'contact_information', 'Contact information', FALSE, 3),
  -- Child Development Center
  ('cdc-enrollment', 'cdc_enrollment_form', 'Duly accomplished CDC enrollment form', TRUE, 1),
  ('cdc-enrollment', 'child_birth_certificate', 'Child''s Birth Certificate (photocopy)', TRUE, 2),
  ('cdc-enrollment', 'barangay_certificate_of_residency', 'Barangay Certificate of Residency for child', TRUE, 3),
  ('cdc-enrollment', 'updated_immunization_record', 'Updated immunization record', TRUE, 4),
  ('cdc-enrollment', 'two_id_photos', 'Two 1x1 ID photos of child', TRUE, 5),
  ('cdc-enrollment', 'parent_guardian_valid_id', 'Parent/guardian valid ID photocopy', TRUE, 6),
  -- BBLC
  ('bblc-training-programs', 'registration_form', 'Accomplished registration form', TRUE, 1),
  ('bblc-training-programs', 'comelec_registration', 'Comelec Registration Slip/ID', TRUE, 2)
) AS r(service_slug, requirement_key, requirement_label, is_required, sort_order)
  ON r.service_slug = c.slug;


-- ============================================================================
-- 4. SERVICE STEPS (official process from the charter; actor: client/agency)
-- ============================================================================
DELETE FROM public.service_steps
WHERE service_category_id IN (
  SELECT id FROM public.service_categories WHERE slug IN (
    'lot-certification-building-renovation','lupon-dispute-settlement','cctv-footage-access',
    'medical-consultation-medicine','immunization-for-children','maternal-care-prenatal-checkup',
    'family-planning','tb-screening-treatment','minor-treatment-first-aid',
    'emergency-response-fire-rescue','basic-life-support-training','tree-cutting-animal-rescue',
    'bpat-peacekeeping-assistance','cdc-enrollment','bblc-training-programs'
  )
);

INSERT INTO public.service_steps (service_category_id, step_number, actor, description)
SELECT c.id, s.step_number, s.actor, s.description
FROM public.service_categories c
JOIN (VALUES
  ('lot-certification-building-renovation', 1, 'client', 'Submit application form and documents'),
  ('lot-certification-building-renovation', 2, 'client', 'Wait for inspection'),
  -- Lupong Tagapamayapa
  ('lupon-dispute-settlement', 1, 'client', 'File a written complaint at the barangay hall'),
  ('lupon-dispute-settlement', 2, 'agency', 'Secretary records the complaint'),
  ('lupon-dispute-settlement', 3, 'agency', 'Punong Barangay contacts the respondent within 3 days'),
  ('lupon-dispute-settlement', 4, 'client', 'Attend the mediation hearing with the Punong Barangay'),
  ('lupon-dispute-settlement', 5, 'client', 'If unresolved, attend conciliation with the Pangkat ng Tagapagkasundo'),
  ('lupon-dispute-settlement', 6, 'agency', 'Pangkat conducts hearings within 15 days'),
  ('lupon-dispute-settlement', 7, 'agency', 'Settlement agreement is drafted if both parties agree'),
  ('lupon-dispute-settlement', 8, 'client', 'If no settlement is reached, obtain a Certificate to File Action')
) AS s(service_slug, step_number, actor, description)
  ON s.service_slug = c.slug;

INSERT INTO public.service_steps (service_category_id, step_number, actor, description)
SELECT c.id, s.step_number, s.actor, s.description
FROM public.service_categories c
JOIN (VALUES
  -- Command Center
  ('cctv-footage-access', 1, 'client', 'Go to the Command Center and request access to CCTV footage'),
  ('cctv-footage-access', 2, 'agency', 'Staff verify identity and purpose; check footage availability'),
  ('cctv-footage-access', 3, 'agency', 'If approved, footage is viewed or released'),
  -- Medical Consultation and Dispensing of Medicine
  ('medical-consultation-medicine', 1, 'client', 'Register and fill out the Patient Information Form'),
  ('medical-consultation-medicine', 2, 'agency', 'Health worker records vital signs'),
  ('medical-consultation-medicine', 3, 'client', 'Wait for the consultation'),
  ('medical-consultation-medicine', 4, 'agency', 'Doctor or nurse conducts the check-up and prescribes medicine'),
  ('medical-consultation-medicine', 5, 'client', 'Proceed to the medicine dispensing area'),
  ('medical-consultation-medicine', 6, 'agency', 'Medicine is dispensed with instructions'),
  ('medical-consultation-medicine', 7, 'client', 'Sign the acknowledgment form'),
  ('medical-consultation-medicine', 8, 'agency', 'Consultation is recorded in the patient logbook'),
  ('medical-consultation-medicine', 9, 'agency', 'Documents are filed for future reference'),
  -- Immunization for Children
  ('immunization-for-children', 1, 'client', 'Register the child''s information at the health center'),
  ('immunization-for-children', 2, 'agency', 'Verify immunization history'),
  ('immunization-for-children', 3, 'agency', 'Administer the vaccine as scheduled'),
  ('immunization-for-children', 4, 'agency', 'Record the vaccination in the immunization card'),
  ('immunization-for-children', 5, 'agency', 'Monitor the child briefly for side effects'),
  ('immunization-for-children', 6, 'agency', 'Issue the schedule for the next vaccination')
) AS s(service_slug, step_number, actor, description)
  ON s.service_slug = c.slug;

INSERT INTO public.service_steps (service_category_id, step_number, actor, description)
SELECT c.id, s.step_number, s.actor, s.description
FROM public.service_categories c
JOIN (VALUES
  -- Maternal Care and Prenatal Check-Up
  ('maternal-care-prenatal-checkup', 1, 'client', 'Register and present the health record'),
  ('maternal-care-prenatal-checkup', 2, 'agency', 'Health worker checks blood pressure and weight'),
  ('maternal-care-prenatal-checkup', 3, 'client', 'Proceed to the consultation room'),
  ('maternal-care-prenatal-checkup', 4, 'agency', 'Midwife or nurse conducts the physical exam and monitors the pregnancy'),
  ('maternal-care-prenatal-checkup', 5, 'agency', 'Iron and folic acid supplements are provided'),
  ('maternal-care-prenatal-checkup', 6, 'agency', 'Consultation is recorded in the health record'),
  ('maternal-care-prenatal-checkup', 7, 'client', 'Receive advice and the schedule for the next check-up'),
  ('maternal-care-prenatal-checkup', 8, 'agency', 'Updated record is filed'),
  -- Family Planning
  ('family-planning', 1, 'client', 'Register at the health center'),
  ('family-planning', 2, 'agency', 'Health worker conducts counseling and explains family planning methods'),
  ('family-planning', 3, 'client', 'Select the preferred method with guidance'),
  ('family-planning', 4, 'agency', 'Family planning supplies are provided'),
  ('family-planning', 5, 'agency', 'Visit is recorded in the family planning logbook'),
  ('family-planning', 6, 'client', 'Receive instructions for use and follow-up'),
  ('family-planning', 7, 'agency', 'Follow-up visit is scheduled'),
  -- TB Screening and Treatment
  ('tb-screening-treatment', 1, 'client', 'Register and submit the referral form, if available'),
  ('tb-screening-treatment', 2, 'agency', 'Health worker screens the patient'),
  ('tb-screening-treatment', 3, 'client', 'Undergo a sputum test'),
  ('tb-screening-treatment', 4, 'agency', 'Sample is sent to the laboratory (about 2 days)'),
  ('tb-screening-treatment', 5, 'agency', 'If positive, the patient is enrolled in DOTS (Directly Observed Treatment, Short-course)'),
  ('tb-screening-treatment', 6, 'client', 'Receive the schedule for treatment and monitoring'),
  ('tb-screening-treatment', 7, 'agency', 'First dose is administered and recorded'),
  ('tb-screening-treatment', 8, 'agency', 'Regular monitoring is conducted (weekly/monthly)'),
  ('tb-screening-treatment', 9, 'agency', 'Completion of the medicine regimen is supervised'),
  -- Minor Treatment and First Aid
  ('minor-treatment-first-aid', 1, 'client', 'Register and describe the injury'),
  ('minor-treatment-first-aid', 2, 'agency', 'Health worker assesses the condition'),
  ('minor-treatment-first-aid', 3, 'agency', 'First aid is administered'),
  ('minor-treatment-first-aid', 4, 'agency', 'Treatment is recorded in the logbook'),
  ('minor-treatment-first-aid', 5, 'client', 'Receive instructions for home care'),
  ('minor-treatment-first-aid', 6, 'agency', 'Follow-up is advised if needed'),
  ('minor-treatment-first-aid', 7, 'agency', 'Referral to the RHU or hospital is made if necessary')
) AS s(service_slug, step_number, actor, description)
  ON s.service_slug = c.slug;

INSERT INTO public.service_steps (service_category_id, step_number, actor, description)
SELECT c.id, s.step_number, s.actor, s.description
FROM public.service_categories c
JOIN (VALUES
  -- BBFRU Emergency Response
  ('emergency-response-fire-rescue', 1, 'client', 'Call the BBFRU Hotline 0946-214-2438 or 911'),
  ('emergency-response-fire-rescue', 2, 'agency', 'Dispatcher verifies the nature and location of the emergency'),
  ('emergency-response-fire-rescue', 3, 'agency', 'Emergency team is dispatched with equipment'),
  ('emergency-response-fire-rescue', 4, 'agency', 'Firefighters respond at the scene'),
  ('emergency-response-fire-rescue', 5, 'agency', 'Stabilization and rescue are performed'),
  ('emergency-response-fire-rescue', 6, 'agency', 'Incident report is submitted to the barangay'),
  -- Basic Life Support Training
  ('basic-life-support-training', 1, 'client', 'Submit a training request'),
  ('basic-life-support-training', 2, 'agency', 'BBFRU confirms the schedule'),
  ('basic-life-support-training', 3, 'client', 'Attend the BLS training session'),
  ('basic-life-support-training', 4, 'agency', 'Practical and lecture sessions are conducted'),
  ('basic-life-support-training', 5, 'agency', 'Certificate of participation is issued'),
  -- Tree Cutting / Animal Rescue
  ('tree-cutting-animal-rescue', 1, 'client', 'Report the situation (exact location and description)'),
  ('tree-cutting-animal-rescue', 2, 'agency', 'BBFRU assesses the request'),
  ('tree-cutting-animal-rescue', 3, 'agency', 'Team is deployed with equipment'),
  ('tree-cutting-animal-rescue', 4, 'agency', 'Assistance or rescue is carried out'),
  ('tree-cutting-animal-rescue', 5, 'agency', 'Area is secured and the report is submitted'),
  ('tree-cutting-animal-rescue', 6, 'client', 'Provide property owner consent, if needed')
) AS s(service_slug, step_number, actor, description)
  ON s.service_slug = c.slug;

INSERT INTO public.service_steps (service_category_id, step_number, actor, description)
SELECT c.id, s.step_number, s.actor, s.description
FROM public.service_categories c
JOIN (VALUES
  -- BPAT Peacekeeping Assistance
  ('bpat-peacekeeping-assistance', 1, 'client', 'Call the BPAT hotline 0938-949-5840 or report to the barangay hall'),
  ('bpat-peacekeeping-assistance', 2, 'agency', 'BPAT personnel verify the report details'),
  ('bpat-peacekeeping-assistance', 3, 'agency', 'Patrol team is dispatched to the location (immediate)'),
  ('bpat-peacekeeping-assistance', 4, 'agency', 'Concern is investigated and assistance is provided'),
  ('bpat-peacekeeping-assistance', 5, 'agency', 'Incident report is filed'),
  -- Child Development Center Enrollment
  ('cdc-enrollment', 1, 'client', 'Proceed to the CDC; the parent/guardian submits the requirements'),
  ('cdc-enrollment', 2, 'agency', 'CDC worker checks the completeness of the documents'),
  ('cdc-enrollment', 3, 'client', 'Accomplish the enrollment form'),
  ('cdc-enrollment', 4, 'agency', 'CDC worker validates the information and records the child''s data'),
  ('cdc-enrollment', 5, 'agency', 'Assessment of the child''s age and developmental stage'),
  ('cdc-enrollment', 6, 'agency', 'Schedule for orientation is given to the parent'),
  ('cdc-enrollment', 7, 'client', 'Attend the parent orientation session'),
  ('cdc-enrollment', 8, 'agency', 'Child is officially enrolled in the CDC program'),
  ('cdc-enrollment', 9, 'agency', 'Records are forwarded to the barangay for documentation'),
  -- BBLC Training Programs
  ('bblc-training-programs', 1, 'client', 'Inquire about available programs'),
  ('bblc-training-programs', 2, 'agency', 'BBLC staff provide the program list and requirements'),
  ('bblc-training-programs', 3, 'client', 'Submit the accomplished registration form and documents'),
  ('bblc-training-programs', 4, 'agency', 'Eligibility is verified and assessed'),
  ('bblc-training-programs', 5, 'client', 'Attend the orientation session'),
  ('bblc-training-programs', 6, 'agency', 'Classes and training sessions are scheduled'),
  ('bblc-training-programs', 7, 'client', 'Participate in the training modules and activities'),
  ('bblc-training-programs', 8, 'agency', 'Progress is monitored and a certificate is issued upon completion')
) AS s(service_slug, step_number, actor, description)
  ON s.service_slug = c.slug;

-- ============================================================================
-- 5. SYSTEM SETTINGS: charter identity (versioned, editable from admin settings)
-- ============================================================================
INSERT INTO public.system_settings (setting_key, value)
VALUES
  ('barangay_identity', '{"name":"Barangay Barretto","city":"Olongapo City","address":"#3 Ilo-Ilo Street, Barretto, Olongapo City","phone":"222-1451 / 222-4295","email":"barangaybarretto00@gmail.com","vision":"A barangay with sufficient income, transparent governance, and active citizen participation.","mission":"Deliver transparent, efficient, and citizen-centered public service."}'),
  ('service_pledge', '{"pledge":"We, the officials and employees of Barangay Barretto, pledge to deliver public services with transparency, efficiency, and citizen-centered governance, in accordance with the standards set in this Citizen''s Charter."}'),
  ('charter_version', '{"title":"Barangay Barretto Citizen''s Charter","edition":"2025 - 1st Edition","legal_basis":"Republic Act No. 11032 (Ease of Doing Business and Efficient Government Service Delivery Act of 2018)"}')
ON CONFLICT (setting_key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

--- Migration 24: Save Service Requests Together With Payments ---
-- Adds a payment ledger entry per request so submitting a request also
-- captures the Citizen's Charter fee snapshot and how/whether it was paid.
-- Idempotent: safe to run multiple times.

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

CREATE INDEX IF NOT EXISTS request_payments_request_idx ON public.request_payments(request_id);
CREATE INDEX IF NOT EXISTS request_payments_resident_idx ON public.request_payments(resident_id);
CREATE INDEX IF NOT EXISTS request_payments_status_idx ON public.request_payments(payment_status);

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

--- Migration 25: Fix verification_attempts RLS (INSERT/UPDATE) ---
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

--- Migration 26: Add published_at to announcements ---
-- Migration 26: Add published_at to announcements
-- Records the real publish time. Before this, the UI reused created_at, so a
-- draft written weeks earlier displayed a stale "Published on" date the moment
-- it went live. Cleared back to NULL when an announcement is unpublished.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.announcements.published_at IS 'When the announcement was most recently published; NULL while it is a draft';

-- Backfill: announcements that are already live were published when created.
UPDATE public.announcements
   SET published_at = created_at
 WHERE is_published = TRUE
   AND published_at IS NULL;

-- Supports the citizen feed (published newest-first) and admin status filters.
CREATE INDEX IF NOT EXISTS announcements_published_feed_idx
  ON public.announcements (is_published, published_at DESC NULLS LAST);

--- Migration 27: Announcement pinning and expiry ---
-- Migration 27: Announcement pinning and expiry
-- `pinned` keeps an important announcement at the top of the citizen feed.
-- `expires_at` hides time-bound notices automatically (e.g. a maintenance window),
-- so they do not linger on the dashboard once they stop applying.
--
-- No scheduled job is needed: migration 26's `published_at` doubles as the
-- publish schedule (a future value means "publish later"), and visibility is
-- resolved at read time.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.announcements.pinned IS 'Pins the announcement above unpinned ones in the citizen feed';
COMMENT ON COLUMN public.announcements.expires_at IS 'Optional time after which the announcement is hidden from residents (NULL = never expires)';

-- Supports the citizen feed: visible rows, pinned first, newest publish first.
CREATE INDEX IF NOT EXISTS announcements_feed_idx
  ON public.announcements (is_published, pinned DESC, published_at DESC);



