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
