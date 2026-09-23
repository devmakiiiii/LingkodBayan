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
