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
