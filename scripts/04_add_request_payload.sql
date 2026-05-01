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
