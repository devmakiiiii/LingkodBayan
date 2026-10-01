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

-- This index used to reference designations(priority_order). Migration 42
-- renames that column to "rank", which means this statement ERRORS on any
-- database where 42 has already run:
--     column "priority_order" does not exist
-- Since migrate.js emits the whole migration history and the SQL editor is
-- re-runnable, that abort killed the script before migration 42 was reached.
--
-- Guarded on the column's existence so this migration is safe on both a fresh
-- database (column is priority_order -> index created) and an already-migrated
-- one (column is "rank" -> skipped). Migration 42 creates the equivalent
-- designations_rank_idx, so no index is lost either way.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.designations'::regclass
      AND attname = 'priority_order'
      AND NOT attisdropped
  ) THEN
    CREATE INDEX IF NOT EXISTS designations_priority_order_idx
      ON public.designations(priority_order ASC, name ASC);
  END IF;
END
$$;
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

--- Migration 24: Save Requests With Payments ---
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

--- Migration 26: Add published_at to Announcements ---
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

--- Migration 27: Announcement Pinning & Expiry ---
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

--- Migration 28: Retire Inactive Officials Status ---
-- Migration 28: Retire the 'inactive' officials status
-- The admin UI no longer exposes active/inactive: officials are either
-- current (active) or archived. Fold any legacy 'inactive' rows into
-- 'active' and tighten the CHECK constraint to ('active', 'archived').

UPDATE public.officials
SET status = 'active'
WHERE LOWER(TRIM(status)) = 'inactive';

ALTER TABLE public.officials
  DROP CONSTRAINT IF EXISTS officials_status_check;

ALTER TABLE public.officials
  ADD CONSTRAINT officials_status_check
  CHECK (status IN ('active', 'archived'));
--- Migration 29: User Notifications ---
-- =====================================================================
-- Migration 29: User notifications
--
-- Gives citizens in-app notifications for identity-verification decisions
-- (and any future non-complaint events). The existing notifications page
-- and unread badge only query complaint_messages, whose schema requires a
-- complaint_id FK, so verification decisions had nowhere to go.
--
-- Rows are inserted with the service-role client by server APIs
-- (e.g. app/api/admin/verification/attempts PATCH); users can only read
-- and mark their own as read.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',       -- e.g. verification_approved, verification_rejected
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                                 -- in-app route to open, e.g. /citizen/verify-id
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications (user_id, is_read, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.user_notifications;
CREATE POLICY "Users can view own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.user_notifications;
CREATE POLICY "Users can mark own notifications read" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No INSERT/DELETE policies on purpose: writes come from the server via the
-- service-role client (bypasses RLS), never directly from browsers.

--- Migration 30: Representative Authorizations (proxy filing) ---
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

--- Migration 31: Document Pickups (clearance claiming) ---
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

--- Migration 32: Duplicate Resident Prevention ---
-- Migration 32: Duplicate-account prevention for residents
-- Adds national_id / id_type to residents (mirroring pre_registered_residents)
-- and enforces uniqueness of normalized national ID and phone number so the
-- same person cannot register multiple accounts with different emails.
--
-- NOTE: the unique indexes below are created with IF NOT EXISTS but will still
-- fail if existing rows already contain duplicates. Before running, merge or
-- clean duplicate rows, e.g.:
--   SELECT regexp_replace(national_id, '\D', '', 'g') AS nid, count(*)
--   FROM public.residents GROUP BY 1 HAVING count(*) > 1;

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS national_id TEXT;
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS id_type TEXT CHECK (id_type IN ('philsys', 'drivers_license', 'passport', 'voter', 'sss', 'tin', 'umid'));

CREATE INDEX IF NOT EXISTS idx_residents_national_id ON public.residents (national_id);
CREATE INDEX IF NOT EXISTS idx_residents_id_type ON public.residents (id_type);

-- Uniqueness is enforced on the digits-only normalization so formats such as
-- "1234-5678-9012", "1234 5678 9012" and "123456789012" are treated the same.
-- Empty normalization (NULL / no digits) is excluded via the partial predicate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_residents_national_id_normalized
  ON public.residents (regexp_replace(national_id, '\D', '', 'g'))
  WHERE coalesce(regexp_replace(national_id, '\D', '', 'g'), '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_residents_phone_normalized
  ON public.residents (regexp_replace(phone, '\D', '', 'g'))
  WHERE coalesce(regexp_replace(phone, '\D', '', 'g'), '') <> '';

--- Migration 33: Durable Rate Limiting ---
-- Migration 33: Durable rate limiting
--
-- The in-memory limiter in lib/rate-limit.ts resets whenever a serverless
-- instance cold-starts, so it cannot stop brute-force abuse of sensitive
-- endpoints (password reset, sign-up OTP) in production. This migration adds
-- a Postgres-backed limiter: an atomic SQL function performs the check inside
-- a single upsert so concurrent requests from different instances share one
-- counter.
--
-- The table has RLS enabled with NO policies — only the service-role key can
-- read or write it, and the SECURITY DEFINER function is revoked from
-- anon/authenticated so it can only be called from trusted server code.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_interval_seconds INTEGER,
  p_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_row public.rate_limits;
BEGIN
  INSERT INTO public.rate_limits (key, window_started_at, count, expires_at)
  VALUES (p_key, v_now, 1, v_now + make_interval(secs => p_interval_seconds))
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limits.expires_at <= v_now THEN 1
      ELSE public.rate_limits.count + 1
    END,
    window_started_at = CASE
      WHEN public.rate_limits.expires_at <= v_now THEN v_now
      ELSE public.rate_limits.window_started_at
    END,
    expires_at = CASE
      WHEN public.rate_limits.expires_at <= v_now
        THEN v_now + make_interval(secs => p_interval_seconds)
      ELSE public.rate_limits.expires_at
    END
  RETURNING * INTO v_row;

  -- Opportunistic cleanup so abandoned windows do not accumulate.
  DELETE FROM public.rate_limits
  WHERE expires_at < v_now - INTERVAL '1 day' AND key <> p_key;

  RETURN v_row.count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER)
  FROM public, anon, authenticated;

--- Migration 34: Single-Barangay Deployment (Barangay Barretto) ---
-- Migration 34: Focus the system on Barangay Barretto (single-barangay deployment)
--
-- LingkodBayan serves exactly one barangay, so the application no longer offers
-- a barangay picker: lib/schemas.ts pins BARANGAY_NAME = 'Barretto', the sign-up
-- action writes it server-side, and the pre-registration import rejects rows for
-- anywhere else. This migration makes the database agree with the application:
--
--   1. Normalizes legacy rows created while the 17-barangay dropdown existed.
--      `residents` rows naming another barangay are relabelled to 'Barretto'
--      (step 2a prints an audit trail of every value that changes);
--      `pre_registered_residents` only has blanks and Barretto spellings
--      normalized, so registry data for another area is left for a human review.
--   2. Defaults `barangay` to 'Barretto' for new rows.
--   3. Adds a CHECK constraint that keeps other barangays out of `residents`
--      (accounts are only ever created by sign-up, so this is always safe). The
--      same constraint is added to `pre_registered_residents` only once no
--      out-of-area row remains, so this migration never silently rewrites or
--      deletes registry data it cannot verify.
--   4. Corrects the address defaults: Barretto is in Olongapo City, Zambales —
--      not Metro Manila, which the old schema and the CSV example assumed.
--
-- Safe to re-run: every statement is idempotent.
--
-- Predicate used by the CHECK constraints and guards below:
--   regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') = 'barretto'
-- i.e. the value is "barretto", optionally written as "Barangay Barretto" or
-- "Brgy. Barretto" in any casing. That is the same set of spellings accepted by
-- canonicalBarangayName() in lib/schemas.ts, and the application always writes
-- the canonical 'Barretto'. The constraints therefore only ever reject a value
-- that reaches the database outside the app (manual SQL), where a loud error is
-- exactly what is wanted.

-- ---------------------------------------------------------------------------
-- 1. (Recommended) Review who is going to change before running the rest
--    The constraint failed the first time because some `residents` rows still
--    name another barangay from the dropdown era. Inspect them here first.
-- ---------------------------------------------------------------------------
-- SELECT id, first_name, last_name, email, barangay, created_at
-- FROM public.residents
-- WHERE barangay IS DISTINCT FROM 'Barretto'
-- ORDER BY created_at;
--
-- SELECT 'residents' AS tbl, barangay, count(*) FROM public.residents GROUP BY 2
-- UNION ALL
-- SELECT 'pre_registered_residents', barangay, count(*) FROM public.pre_registered_residents GROUP BY 2
-- ORDER BY 1, 3 DESC;

-- ---------------------------------------------------------------------------
-- 2a. Audit trail: list every value that is about to change, so the SQL editor
--     output shows exactly what this migration relabels. Rows already stored as
--     'Barretto' are left untouched and keep their updated_at.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT barangay, count(*) AS rows_affected
    FROM public.residents
    WHERE barangay IS DISTINCT FROM 'Barretto'
    GROUP BY barangay
    ORDER BY 2 DESC
  LOOP
    RAISE NOTICE 'residents: relabelling % row(s) from "%" to Barretto.', r.rows_affected, r.barangay;
  END LOOP;

  FOR r IN
    SELECT barangay, count(*) AS rows_affected
    FROM public.pre_registered_residents
    WHERE barangay IS DISTINCT FROM 'Barretto'
      AND regexp_replace(lower(btrim(coalesce(barangay, ''))), '^(barangay|brgy\.?)[[:space:]]+', '') IN ('', 'barretto')
    GROUP BY barangay
    ORDER BY 2 DESC
  LOOP
    RAISE NOTICE 'pre_registered_residents: normalizing % row(s) from "%" to Barretto.', r.rows_affected, r.barangay;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2b. residents — every account in this system belongs to Barangay Barretto.
--     The sign-up form no longer offers a barangay and the server action pins
--     the value, so a resident row naming another barangay can only be legacy
--     data left over from the old dropdown. Those rows are relabelled here (the
--     2a output above lists them for auditing); anyone registered for a
--     different barangay would not be using this deployment in the first place.
-- ---------------------------------------------------------------------------
UPDATE public.residents
SET barangay = 'Barretto',
    updated_at = now()
WHERE barangay IS DISTINCT FROM 'Barretto';

-- ---------------------------------------------------------------------------
-- 2c. pre_registered_residents — only blanks and Barretto spellings are
--     normalized. A registry row naming another barangay is deliberately left
--     in place for a human to review (step 1), because the registry decides
--     identity matching and this migration must not silently relabel resident
--     data of another area.
-- ---------------------------------------------------------------------------
UPDATE public.pre_registered_residents
SET barangay = 'Barretto',
    updated_at = now()
WHERE barangay IS DISTINCT FROM 'Barretto'
  AND regexp_replace(lower(btrim(coalesce(barangay, ''))), '^(barangay|brgy\.?)[[:space:]]+', '') IN ('', 'barretto');

-- Anything left with a different barangay was imported for another area. Fix it
-- here if that import was a mistake; the app rejects such rows from now on.
-- UPDATE public.pre_registered_residents SET barangay = 'Barretto'
-- WHERE regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') <> 'barretto';

-- ---------------------------------------------------------------------------
-- 3. Defaults for new rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.residents ALTER COLUMN barangay SET DEFAULT 'Barretto';
ALTER TABLE public.pre_registered_residents ALTER COLUMN barangay SET DEFAULT 'Barretto';

ALTER TABLE public.pre_registered_residents ALTER COLUMN city_municipality SET DEFAULT 'Olongapo City';
ALTER TABLE public.pre_registered_residents ALTER COLUMN province SET DEFAULT 'Zambales';

-- Rows the old 'Metro Manila' default already stamped are corrected when the
-- address is (or was left blank as) Olongapo; other cities are left untouched.
UPDATE public.pre_registered_residents
SET province = 'Zambales',
    updated_at = now()
WHERE (province IS NULL OR btrim(province) = '' OR province ILIKE '%metro manila%')
  AND (city_municipality IS NULL OR btrim(city_municipality) = '' OR city_municipality ILIKE '%olongapo%');

-- ---------------------------------------------------------------------------
-- 4. Enforce the single-barangay invariant
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_out_of_area INTEGER;
BEGIN
  SELECT count(*) INTO v_out_of_area
  FROM public.residents
  WHERE regexp_replace(lower(btrim(coalesce(barangay, ''))), '^(barangay|brgy\.?)[[:space:]]+', '') <> 'barretto';

  IF v_out_of_area > 0 THEN
    RAISE NOTICE
      'Skipped residents_barangay_is_barretto: % resident row(s) still reference another barangay. Relabel them (step 2b) and re-run this migration.',
      v_out_of_area;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'residents_barangay_is_barretto'
  ) THEN
    ALTER TABLE public.residents
      ADD CONSTRAINT residents_barangay_is_barretto
      CHECK (regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') = 'barretto');
    RAISE NOTICE 'Added residents_barangay_is_barretto CHECK constraint.';
  ELSE
    RAISE NOTICE 'residents_barangay_is_barretto already present.';
  END IF;
END $$;

DO $$
DECLARE
  v_out_of_area INTEGER;
BEGIN
  SELECT count(*) INTO v_out_of_area
  FROM public.pre_registered_residents
  WHERE barangay IS NULL
     OR regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') <> 'barretto';

  IF v_out_of_area > 0 THEN
    RAISE NOTICE
      'Skipped pre_registered_residents_barangay_is_barretto: % row(s) still reference another barangay. Review them (step 1) and re-run this migration to enforce the constraint.',
      v_out_of_area;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pre_registered_residents_barangay_is_barretto'
  ) THEN
    ALTER TABLE public.pre_registered_residents
      ADD CONSTRAINT pre_registered_residents_barangay_is_barretto
      CHECK (regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') = 'barretto');
    RAISE NOTICE 'Added pre_registered_residents_barangay_is_barretto CHECK constraint.';
  ELSE
    RAISE NOTICE 'pre_registered_residents_barangay_is_barretto already present.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Verify
-- ---------------------------------------------------------------------------
-- SELECT count(*) AS residents_outside_barretto
-- FROM public.residents
-- WHERE regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') <> 'barretto';
--
-- SELECT conname FROM pg_constraint
-- WHERE conname IN ('residents_barangay_is_barretto', 'pre_registered_residents_barangay_is_barretto');

-- ---------------------------------------------------------------------------
-- 6. Rollback (schema only — the relabelled `barangay`/`province` values in
--    step 2/3 are data changes and are not reverted by these statements)
-- ---------------------------------------------------------------------------
-- ALTER TABLE public.residents DROP CONSTRAINT IF EXISTS residents_barangay_is_barretto;
-- ALTER TABLE public.pre_registered_residents DROP CONSTRAINT IF EXISTS pre_registered_residents_barangay_is_barretto;
-- ALTER TABLE public.residents ALTER COLUMN barangay DROP DEFAULT;
-- ALTER TABLE public.pre_registered_residents ALTER COLUMN barangay DROP DEFAULT;
-- ALTER TABLE public.pre_registered_residents ALTER COLUMN city_municipality DROP DEFAULT;
-- ALTER TABLE public.pre_registered_residents ALTER COLUMN province SET DEFAULT 'Metro Manila';

--- Migration 35: Durable OCR Job Store ---
-- Migration 35: Durable OCR verification job store
-- The in-memory job store in lib/verification-jobs.ts is a process-local Map,
-- so on a multi-instance deploy (serverless, or `next start` behind a load
-- balancer) the /status poll can reach an instance that never saw the upload
-- and the resident's verification hangs or fails even though OCR succeeded.
-- This migration backs the store with Postgres so any instance can read a job.
--
-- RLS is enabled with NO policies: only the service-role key (which bypasses
-- RLS) can read or write these rows. The endpoints all use the admin client, so
-- no resident or admin needs direct access, and OCR results contain PII read
-- off a government ID — keeping the table unreachable to `authenticated` is
-- deliberate.
--
-- `expires_at` lets the cleanup below reap rows; an upload that is never polled
-- does not accumulate forever.

CREATE TABLE IF NOT EXISTS public.verification_ocr_jobs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour')
);

-- The status endpoint looks jobs up by id; the owner check happens in the route.
CREATE INDEX IF NOT EXISTS idx_verification_ocr_jobs_user
  ON public.verification_ocr_jobs (user_id, created_at DESC);

ALTER TABLE public.verification_ocr_jobs ENABLE ROW LEVEL SECURITY;

-- Reap expired jobs on write. Cheap, and bounded by the one-hour expiry, so the
-- table stays small without needing a scheduled job.
--
-- The trigger matters: `expires_at` alone does not delete anything, and these
-- rows hold OCR output read off a resident's government ID. Without this the
-- table grows without bound and PII is retained indefinitely, which is the
-- opposite of what the `expires_at` column implies.
--
-- SECURITY DEFINER is required: the DELETE runs as the function owner (postgres)
-- rather than the caller's role, so it is not subject to the RLS enabled above.
--
-- This is the body, kept as RETURNS VOID so it stays callable directly — the
-- Supabase SQL Editor's "Run RPC" panel exposes it as
-- /rpc/prune_verification_ocr_jobs, which makes the sweep a one-click manual
-- recovery if the trigger is ever dropped.
CREATE OR REPLACE FUNCTION public.prune_verification_ocr_jobs()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.verification_ocr_jobs
  WHERE expires_at < now() - INTERVAL '1 day';
$$;

REVOKE ALL ON FUNCTION public.prune_verification_ocr_jobs()
  FROM public, anon, authenticated;

-- The trigger wrapper, which is what actually reaps rows on write.
--
-- It MUST be RETURNS TRIGGER: Postgres rejects a CREATE TRIGGER whose target
-- function returns anything else (42P17: "function ... must return type
-- trigger"). So the work lives in the VOID function above and this thin wrapper
-- just calls it and returns NULL, which is what an AFTER trigger must do.
--
-- Statement-level on purpose. A job is inserted once then updated once or twice
-- while the resident polls; a row-level trigger would run the DELETE a few extra
-- times per verification for no benefit, since the table is bounded by the
-- expiry either way.
CREATE OR REPLACE FUNCTION public.trg_prune_verification_ocr_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.prune_verification_ocr_jobs();
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_prune_verification_ocr_jobs()
  FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prune_verification_ocr_jobs
  ON public.verification_ocr_jobs;

CREATE TRIGGER trg_prune_verification_ocr_jobs
  AFTER INSERT OR UPDATE ON public.verification_ocr_jobs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_prune_verification_ocr_jobs();
--- Migration 36: Verification Gate on Request Filing ---
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

-- Also drop this migration's own policy. Without it the script only works on a
-- database that has never run migration 36: Postgres raises
--   ERROR: 42710: policy "Verified residents can create requests" already exists
-- on a second run, because the DROP above targets the *old* policy name. Since
-- migrate.js replays every migration, that made the whole batch abort partway
-- through — leaving migrations 37-39 (including the admin authorization
-- hardening) unapplied. Idempotent: safe to run any number of times.
DROP POLICY IF EXISTS "Verified residents can create requests" ON public.requests;

CREATE POLICY "Verified residents can create requests" ON public.requests
  FOR INSERT WITH CHECK (
    resident_id IN (
      SELECT r.id
      FROM public.residents r
      WHERE r.user_id = auth.uid()
        AND r.verification_status IN ('auto_verified', 'id_verified')
    )
  );
--- Migration 37: Backfill Verification Claim ---
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
--- Migration 38: Fix Proxy Party Names ---
-- ============================================================================
-- Migration 38: Resolve proxy-filing counterparty names
--
-- Bug: the citizens' proxy pages showed "Unnamed resident" for the other party
-- of an authorization, and the "File on behalf of" picker showed blank entries.
--
-- Cause: the residents table has a strict SELECT policy
-- ("Residents can view their own data" -> USING (auth.uid() = user_id)).
-- lib/representatives.ts loads authorizations through the caller's own Supabase
-- client and embeds the other party with
--   represented:residents!representative_authorizations_represented_resident_id_fkey(...)
-- PostgREST applies the residents SELECT policy to that embedded join, so the
-- counterparty's row is filtered out and the join resolves to NULL. The UI then
-- fell back to its "Unnamed resident" placeholder.
--
-- We must not loosen the residents SELECT policy just to make a display work:
-- that would expose every resident's full row (address, DOB, phone, ...) to
-- anyone they ever authorized. Instead this SECURITY DEFINER helper exposes a
-- deliberately narrow projection - id, first_name, last_name, email - and only
-- for residents who share an authorization row with the caller. The resident id
-- is the account's own primary key, the name is what the party already knows
-- (they typed or picked it when granting), and the email is only ever used as a
-- display fallback.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.proxy_party_directory(p_resident_ids uuid[])
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.id, r.first_name, r.last_name, r.email
  FROM public.residents r
  JOIN public.representative_authorizations ra
    ON ra.represented_resident_id = r.id
    OR ra.representative_resident_id = r.id
  WHERE r.id = ANY (p_resident_ids)
    AND (
      ra.represented_resident_id = public.current_resident_id()
      OR ra.representative_resident_id = public.current_resident_id()
    );
$$;

-- Only authenticated portal users may resolve their own proxy counterparties.
REVOKE ALL ON FUNCTION public.proxy_party_directory(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proxy_party_directory(uuid[]) TO authenticated;

--- Migration 39: Harden Admin Authorization (drop user_metadata trust) ---
-- Migration 39: stop trusting user_metadata for admin authorization
--
-- WHY THIS IS NEEDED
-- ----------------------------------------------------------------------------
-- `public.is_admin_user()` guards every admin RLS policy, and until now it
-- accepted a role out of `auth.jwt() -> 'user_metadata'`. `user_metadata` is
-- writable by the signed-in account itself:
--
--     supabase.auth.updateUser({ data: { role: 'admin' } })
--
-- so any resident could mint an admin claim, refresh their session, and then
-- read or write every table whose policy calls is_admin_user() — residents,
-- requests, complaints, feedback, officials, system_settings, audit logs.
--
-- The application layer was already hardened to read `app_metadata` only
-- (lib/roles.ts, used by middleware.ts, lib/auth.ts, lib/admin-auth.ts and the
-- /api/admin/* handlers). This migration makes the database agree, so the two
-- can no longer disagree about who is an admin. A resident who forges
-- `user_metadata.role` is then rejected at both layers.
--
-- ORDER OF OPERATIONS
-- ----------------------------------------------------------------------------
-- Step 1 first copies `user_metadata.role` into `app_metadata.role` for any
-- account that only ever had the role in the writable place, so a legitimate
-- admin provisioned before `scripts/setup_admin_account.js` started writing
-- `app_metadata` keeps access. Step 2 then removes the fallback. Run the whole
-- file; it is idempotent and safe to re-run.
--
-- NOTE ON auth.users: this table is owned by Supabase's GoTrue, which is why the
-- app writes metadata through the admin API rather than SQL. The direct write in
-- step 1 is deliberate and one-off because there is no bulk equivalent of the
-- admin API. Run it during a quiet period; the change reaches a session on its
-- next token refresh.

-- ---------------------------------------------------------------------------
-- Step 1: backfill app_metadata.role from user_metadata.role
-- ---------------------------------------------------------------------------
-- `jsonb_set` merges into the existing document instead of replacing it, so
-- `provider`, `providers`, and any other app_metadata keys are preserved.
UPDATE auth.users AS au
SET raw_app_meta_data = jsonb_set(
      COALESCE(au.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(au.raw_user_meta_data ->> 'role')
    )
WHERE (au.raw_user_meta_data ->> 'role') IN ('admin', 'super_admin')
  AND COALESCE(au.raw_app_meta_data ->> 'role', '') NOT IN ('admin', 'super_admin');

-- ---------------------------------------------------------------------------
-- Step 2: replace the admin helpers — admin_users membership + app_metadata
-- ---------------------------------------------------------------------------
-- Only the user_metadata branch is dropped; the admin_users lookup and the
-- app_metadata branch behave exactly as before.
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
  OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false);
$$;

-- ---------------------------------------------------------------------------
-- Verification (run these by hand; they are intentionally not executed)
-- ---------------------------------------------------------------------------
-- 1. Accounts that still carry an admin role ONLY in the writable metadata.
--    After step 1 this list should be empty, except for accounts you intend to
--    demote. Anyone left here is now treated as a plain resident.
--
-- SELECT au.id,
--        au.email,
--        au.raw_user_meta_data ->> 'role' AS user_metadata_role,
--        au.raw_app_meta_data  ->> 'role' AS app_metadata_role,
--        (SELECT count(*) FROM public.admin_users a WHERE a.user_id = au.id) AS admin_rows
-- FROM auth.users au
-- WHERE (au.raw_user_meta_data ->> 'role') IN ('admin', 'super_admin');
--
-- 2. Confirm the helpers no longer reference user_metadata. Neither body should
--    contain the text "user_metadata".
--
-- SELECT proname, prosrc FROM pg_proc
-- WHERE proname IN ('is_admin_user', 'is_super_admin_user');
--
-- 3. Prove a forged claim no longer grants access. Run once as a resident
--    (returns false) after calling
--    supabase.auth.updateUser({ data: { role: 'admin' } }) from the browser:
--
-- SELECT public.is_admin_user(auth.uid());

--- Migration 40: Pre-Registered Residents Without Email ---
-- Migration 40: Allow pre-registered residents without an email address
--
-- The registry is seeded from barangay household records (census sheets), which
-- routinely list a name, birth date and address but no email. Migration 16 made
-- `email` NOT NULL, so every such row was rejected by the bulk importer and the
-- admin saw "0 residents imported successfully".
--
-- Identity verification still works without an email: findPreRegisteredCandidates
-- matches on phone / national ID and falls back to a name lookup, and
-- calculateMatchScore simply scores the missing email signal as zero.
--
-- The UNIQUE constraint on `email` is kept: PostgreSQL treats NULLs as distinct,
-- so any number of email-less rows are allowed while real addresses stay unique.

ALTER TABLE public.pre_registered_residents
  ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN public.pre_registered_residents.email IS
  'Contact email captured at registration, when known. NULL for household records imported without one.';

--- Migration 41: Structured Name Parts on Officials ---
-- Migration 41: Structured name parts on officials
--
-- The officials table stored a single `full_name` string, while every other
-- person record in the system (residents, accounts) keeps first/middle/last.
-- One string cannot be alphabetised by surname or printed as "Dela Cruz, Juan",
-- and splitting it later is unreliable because Filipino surnames are often
-- compound ("Dela Cruz", "Macapagal", "Santos Benitez").
--
-- `full_name` is kept as the display column every existing query reads: the app
-- composes it from the parts on save, so no display, report or sort code needs
-- to change. The new columns are nullable on purpose - existing rows are NOT
-- parsed automatically (a wrong guess is worse than a blank), they simply stay
-- empty until an admin re-saves the record from the Edit dialog.
--
-- Note: unlike residents (who keep a full `middle_name`), officials are
-- recorded with a middle INITIAL only, hence `middle_initial`.

ALTER TABLE public.officials
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS middle_initial TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS suffix TEXT;

COMMENT ON COLUMN public.officials.first_name IS 'Given name. NULL for rows created before migration 41.';
COMMENT ON COLUMN public.officials.middle_initial IS 'Middle initial only, stored as a capitalised letter with a period (e.g. S.). Officials are recorded with initials, not full middle names.';
COMMENT ON COLUMN public.officials.last_name IS 'Family name / surname. NULL for rows created before migration 41.';
COMMENT ON COLUMN public.officials.suffix IS 'Name extension such as Jr. or III, optional.';
--- Migration 42: Rename Designation priority_order to rank + auto-assign ---
-- Migration 42: Rename `priority_order` to `rank` and make it automatic
--
-- Two problems with `designations.priority_order`:
--
--   1. It was a hand-typed integer that only affected display sorting, so it
--      drifted and duplicates inside a category were silently accepted.
--   2. The name collided with two unrelated columns in this schema -
--      `requests.priority` and `complaints.priority_level` - which mean triage
--      urgency on a specific item, not the standing rank of an office. A
--      column named `rank` cannot be mistaken for either.
--
-- The rename is folded into this migration rather than shipped separately so a
-- deployment applies it in one step. `RENAME COLUMN` also carries the existing
-- index across automatically; it is renamed afterwards to match.
--
-- Steps:
--   1. Rename the column and the index that references it.
--   2. Renumber existing rows densely per category, preserving the current
--      relative order (old rank, then name). Gaps collapse; relative ranking
--      is unchanged.
--   3. Enforce UNIQUE (category, rank) so ties cannot be created.
--
-- Numbering is per category on purpose: a Barangay Captain and an SK
-- Chairperson are both rank 1, because they head separate groups that are
-- never compared against each other. Officials are sorted within a category.
--
-- New designations get max(rank) + 1 for their category, assigned by the app
-- (see getNextRank in lib/governance.ts). An admin may still type an explicit
-- number to override.

-- ─────────────────────────────────────────────────────────────────────────────
-- DIAGNOSTIC (read-only, safe to run at any time)
--
-- Paste this on its own to confirm what state the table is actually in. The
-- RENAME is transactional, so a failure either leaves the column fully renamed
-- or fully untouched - never half done.
--
-- Expect ONE row: the column is named "rank" (NOT NULL, default 999).
-- If it reports priority_order instead, the rename never ran.
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT column_name, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'designations'
--   AND column_name IN ('priority_order', 'rank');

-- 1a. Rename the column. `"rank"` is quoted because RANK is also a window
--     function name in Postgres (non-reserved, but quoting avoids ambiguity).
--
--     Postgres has no `RENAME COLUMN IF EXISTS`, so the rename is wrapped in a
--     DO block that checks pg_attribute first. This matters because
--     migrate.js emits the whole migration history and Supabase's SQL editor is
--     re-runnable: without the guard, a second run of an already-migrated
--     database aborts with `column "priority_order" does not exist` and takes
--     every statement after it down with it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.designations'::regclass
      AND attname = 'priority_order'
      AND NOT attisdropped
  ) THEN
    ALTER TABLE public.designations RENAME COLUMN priority_order TO "rank";
    RAISE NOTICE 'designations.priority_order renamed to rank';
  ELSE
    RAISE NOTICE 'designations.priority_order already renamed - skipping';
  END IF;
END
$$;

-- 1b. The 2026-06 index from migration 05 follows the renamed column; give it a
--     name that matches. Both directions are guarded so re-running is safe.
DROP INDEX IF EXISTS public.designations_priority_order_idx;
CREATE INDEX IF NOT EXISTS designations_rank_idx ON public.designations("rank" ASC, name ASC);

-- 2. Renumber densely per category, keeping the existing relative order.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY category
      ORDER BY "rank" ASC, name ASC
    ) AS new_rank
  FROM public.designations
)
UPDATE public.designations d
SET "rank" = r.new_rank,
    updated_at = NOW()
FROM ranked r
WHERE d.id = r.id
  AND d."rank" IS DISTINCT FROM r.new_rank;

-- 3. Enforce uniqueness within a category (idempotent).
DROP INDEX IF EXISTS public.designations_category_priority_order_key;
CREATE UNIQUE INDEX IF NOT EXISTS designations_category_rank_key
  ON public.designations(category ASC, "rank" ASC);

COMMENT ON COLUMN public.designations."rank" IS
  'Standing rank within the designation''s category (1 = highest). Unique per category; assigned as max+1 when the admin leaves the field blank. Not to be confused with requests.priority / complaints.priority_level, which are per-item triage urgency.';
--- Migration 43: Derive Designation Badge Color From Category ---
-- Migration 43: Derive designation badge color from the category
--
-- `designations.badge_color` was a hand-picked color stored per designation.
-- Two problems:
--
--   1. It invited arbitrary values. The seeded barangay set was four unrelated
--      shades (dark green #166534, green #28A745, teal #0f766e, sky blue
--      #0ea5e9) implying a distinction between Captain and Treasurer that does
--      not exist in practice. Nothing told an admin which color to pick, so any
--      value from the swatch control was equally "correct".
--
--   2. Nothing on the citizen-facing side used it. Only two admin tables render
--      a badge; the public directory (app/citizen/offices) reads from
--      charter_services and has never shown a color. So the column was
--      maintained by hand for the benefit of two admin tables.
--
-- The one distinction that IS real is category: SK officials are visually
-- distinct from barangay officials, and staff are neither. So the color is now
-- derived from the category in getDesignationBadgeColor() (lib/governance.ts)
-- and the column is dropped. The four barangay shades collapse to one honest
-- green, SK keeps the purple that genuinely separates it, staff keeps the gray.
--
-- This also removes the only NOT NULL, defaulted column the app had to supply
-- on every designation write, which is a class of insert failure this schema
-- has been bitten by before (see scripts/_check_schema.mjs).

ALTER TABLE public.designations
  DROP COLUMN IF EXISTS badge_color;
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

