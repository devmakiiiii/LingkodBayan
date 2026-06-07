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