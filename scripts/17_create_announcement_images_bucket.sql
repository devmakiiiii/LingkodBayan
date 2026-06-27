-- Create the announcement-images storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-images', 'announcement-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

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