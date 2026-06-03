-- Fix: Add missing columns to complaints table that are expected by the app
-- Run this if you get PGRST204 errors about evidence_url, latitude, longitude, or location_address

-- Add evidence_url column
ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS evidence_url TEXT;

-- Add geolocation columns
ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Add additional complaint management columns
ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS priority_level TEXT DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS assigned_official_id UUID REFERENCES public.officials(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

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