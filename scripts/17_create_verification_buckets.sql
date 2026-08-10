-- Migration 17: Create ID documents storage bucket
-- Private bucket for identity document uploads (PII-sensitive)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('id-documents', 'id-documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policy: only admins can read id-documents
INSERT INTO storage.policy (id, bucket_id, name, definition, effect)
VALUES (
  gen_random_uuid(),
  'id-documents',
  'Admin can read id documents',
  'SELECT auth.uid()::text = auth.uid()::text WHERE (storage.foldername(name))[1] = auth.uid()::text OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN (''admin'', ''super_admin''))',
  'ALLOW'
)
ON CONFLICT DO NOTHING;

-- Storage policy: residents can upload only to their own folder
INSERT INTO storage.policy (id, bucket_id, name, definition, effect)
VALUES (
  gen_random_uuid(),
  'id-documents',
  'Residents can upload id documents to their own folder',
  '(storage.foldername(name))[1] = auth.uid()::text',
  'ALLOW'
)
ON CONFLICT DO NOTHING;

-- Storage policy: residents can read their own id documents
INSERT INTO storage.policy (id, bucket_id, name, definition, effect)
VALUES (
  gen_random_uuid(),
  'id-documents',
  'Residents can read their own id documents',
  'SELECT (storage.foldername(name))[1] = auth.uid()::text',
  'ALLOW'
)
ON CONFLICT DO NOTHING;
