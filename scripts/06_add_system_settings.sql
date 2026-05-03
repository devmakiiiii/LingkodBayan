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
