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
