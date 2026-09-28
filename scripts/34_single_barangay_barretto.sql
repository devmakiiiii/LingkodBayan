-- Migration 34: Focus the system on Barangay Barretto (single-barangay deployment)
--
-- LingkodBayan serves exactly one barangay, so the application no longer offers
-- a barangay picker: lib/schemas.ts pins BARANGAY_NAME = 'Barretto', the sign-up
-- action writes it server-side, and the pre-registration import rejects rows for
-- anywhere else. This migration makes the database agree with the application:
--
--   1. Normalizes legacy rows created while the 17-barangay dropdown existed.
--      `residents` rows naming another barangay are relabelled to 'Barretto'
--      (step 2a prints an audit trail of every value that changes);
--      `pre_registered_residents` only has blanks and Barretto spellings
--      normalized, so registry data for another area is left for a human review.
--   2. Defaults `barangay` to 'Barretto' for new rows.
--   3. Adds a CHECK constraint that keeps other barangays out of `residents`
--      (accounts are only ever created by sign-up, so this is always safe). The
--      same constraint is added to `pre_registered_residents` only once no
--      out-of-area row remains, so this migration never silently rewrites or
--      deletes registry data it cannot verify.
--   4. Corrects the address defaults: Barretto is in Olongapo City, Zambales —
--      not Metro Manila, which the old schema and the CSV example assumed.
--
-- Safe to re-run: every statement is idempotent.
--
-- Predicate used by the CHECK constraints and guards below:
--   regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') = 'barretto'
-- i.e. the value is "barretto", optionally written as "Barangay Barretto" or
-- "Brgy. Barretto" in any casing. That is the same set of spellings accepted by
-- canonicalBarangayName() in lib/schemas.ts, and the application always writes
-- the canonical 'Barretto'. The constraints therefore only ever reject a value
-- that reaches the database outside the app (manual SQL), where a loud error is
-- exactly what is wanted.

-- ---------------------------------------------------------------------------
-- 1. (Recommended) Review who is going to change before running the rest
--    The constraint failed the first time because some `residents` rows still
--    name another barangay from the dropdown era. Inspect them here first.
-- ---------------------------------------------------------------------------
-- SELECT id, first_name, last_name, email, barangay, created_at
-- FROM public.residents
-- WHERE barangay IS DISTINCT FROM 'Barretto'
-- ORDER BY created_at;
--
-- SELECT 'residents' AS tbl, barangay, count(*) FROM public.residents GROUP BY 2
-- UNION ALL
-- SELECT 'pre_registered_residents', barangay, count(*) FROM public.pre_registered_residents GROUP BY 2
-- ORDER BY 1, 3 DESC;

-- ---------------------------------------------------------------------------
-- 2a. Audit trail: list every value that is about to change, so the SQL editor
--     output shows exactly what this migration relabels. Rows already stored as
--     'Barretto' are left untouched and keep their updated_at.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT barangay, count(*) AS rows_affected
    FROM public.residents
    WHERE barangay IS DISTINCT FROM 'Barretto'
    GROUP BY barangay
    ORDER BY 2 DESC
  LOOP
    RAISE NOTICE 'residents: relabelling % row(s) from "%" to Barretto.', r.rows_affected, r.barangay;
  END LOOP;

  FOR r IN
    SELECT barangay, count(*) AS rows_affected
    FROM public.pre_registered_residents
    WHERE barangay IS DISTINCT FROM 'Barretto'
      AND regexp_replace(lower(btrim(coalesce(barangay, ''))), '^(barangay|brgy\.?)[[:space:]]+', '') IN ('', 'barretto')
    GROUP BY barangay
    ORDER BY 2 DESC
  LOOP
    RAISE NOTICE 'pre_registered_residents: normalizing % row(s) from "%" to Barretto.', r.rows_affected, r.barangay;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2b. residents — every account in this system belongs to Barangay Barretto.
--     The sign-up form no longer offers a barangay and the server action pins
--     the value, so a resident row naming another barangay can only be legacy
--     data left over from the old dropdown. Those rows are relabelled here (the
--     2a output above lists them for auditing); anyone registered for a
--     different barangay would not be using this deployment in the first place.
-- ---------------------------------------------------------------------------
UPDATE public.residents
SET barangay = 'Barretto',
    updated_at = now()
WHERE barangay IS DISTINCT FROM 'Barretto';

-- ---------------------------------------------------------------------------
-- 2c. pre_registered_residents — only blanks and Barretto spellings are
--     normalized. A registry row naming another barangay is deliberately left
--     in place for a human to review (step 1), because the registry decides
--     identity matching and this migration must not silently relabel resident
--     data of another area.
-- ---------------------------------------------------------------------------
UPDATE public.pre_registered_residents
SET barangay = 'Barretto',
    updated_at = now()
WHERE barangay IS DISTINCT FROM 'Barretto'
  AND regexp_replace(lower(btrim(coalesce(barangay, ''))), '^(barangay|brgy\.?)[[:space:]]+', '') IN ('', 'barretto');

-- Anything left with a different barangay was imported for another area. Fix it
-- here if that import was a mistake; the app rejects such rows from now on.
-- UPDATE public.pre_registered_residents SET barangay = 'Barretto'
-- WHERE regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') <> 'barretto';

-- ---------------------------------------------------------------------------
-- 3. Defaults for new rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.residents ALTER COLUMN barangay SET DEFAULT 'Barretto';
ALTER TABLE public.pre_registered_residents ALTER COLUMN barangay SET DEFAULT 'Barretto';

ALTER TABLE public.pre_registered_residents ALTER COLUMN city_municipality SET DEFAULT 'Olongapo City';
ALTER TABLE public.pre_registered_residents ALTER COLUMN province SET DEFAULT 'Zambales';

-- Rows the old 'Metro Manila' default already stamped are corrected when the
-- address is (or was left blank as) Olongapo; other cities are left untouched.
UPDATE public.pre_registered_residents
SET province = 'Zambales',
    updated_at = now()
WHERE (province IS NULL OR btrim(province) = '' OR province ILIKE '%metro manila%')
  AND (city_municipality IS NULL OR btrim(city_municipality) = '' OR city_municipality ILIKE '%olongapo%');

-- ---------------------------------------------------------------------------
-- 4. Enforce the single-barangay invariant
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_out_of_area INTEGER;
BEGIN
  SELECT count(*) INTO v_out_of_area
  FROM public.residents
  WHERE regexp_replace(lower(btrim(coalesce(barangay, ''))), '^(barangay|brgy\.?)[[:space:]]+', '') <> 'barretto';

  IF v_out_of_area > 0 THEN
    RAISE NOTICE
      'Skipped residents_barangay_is_barretto: % resident row(s) still reference another barangay. Relabel them (step 2b) and re-run this migration.',
      v_out_of_area;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'residents_barangay_is_barretto'
  ) THEN
    ALTER TABLE public.residents
      ADD CONSTRAINT residents_barangay_is_barretto
      CHECK (regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') = 'barretto');
    RAISE NOTICE 'Added residents_barangay_is_barretto CHECK constraint.';
  ELSE
    RAISE NOTICE 'residents_barangay_is_barretto already present.';
  END IF;
END $$;

DO $$
DECLARE
  v_out_of_area INTEGER;
BEGIN
  SELECT count(*) INTO v_out_of_area
  FROM public.pre_registered_residents
  WHERE barangay IS NULL
     OR regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') <> 'barretto';

  IF v_out_of_area > 0 THEN
    RAISE NOTICE
      'Skipped pre_registered_residents_barangay_is_barretto: % row(s) still reference another barangay. Review them (step 1) and re-run this migration to enforce the constraint.',
      v_out_of_area;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pre_registered_residents_barangay_is_barretto'
  ) THEN
    ALTER TABLE public.pre_registered_residents
      ADD CONSTRAINT pre_registered_residents_barangay_is_barretto
      CHECK (regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') = 'barretto');
    RAISE NOTICE 'Added pre_registered_residents_barangay_is_barretto CHECK constraint.';
  ELSE
    RAISE NOTICE 'pre_registered_residents_barangay_is_barretto already present.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Verify
-- ---------------------------------------------------------------------------
-- SELECT count(*) AS residents_outside_barretto
-- FROM public.residents
-- WHERE regexp_replace(lower(btrim(barangay)), '^(barangay|brgy\.?)[[:space:]]+', '') <> 'barretto';
--
-- SELECT conname FROM pg_constraint
-- WHERE conname IN ('residents_barangay_is_barretto', 'pre_registered_residents_barangay_is_barretto');

-- ---------------------------------------------------------------------------
-- 6. Rollback (schema only — the relabelled `barangay`/`province` values in
--    step 2/3 are data changes and are not reverted by these statements)
-- ---------------------------------------------------------------------------
-- ALTER TABLE public.residents DROP CONSTRAINT IF EXISTS residents_barangay_is_barretto;
-- ALTER TABLE public.pre_registered_residents DROP CONSTRAINT IF EXISTS pre_registered_residents_barangay_is_barretto;
-- ALTER TABLE public.residents ALTER COLUMN barangay DROP DEFAULT;
-- ALTER TABLE public.pre_registered_residents ALTER COLUMN barangay DROP DEFAULT;
-- ALTER TABLE public.pre_registered_residents ALTER COLUMN city_municipality DROP DEFAULT;
-- ALTER TABLE public.pre_registered_residents ALTER COLUMN province SET DEFAULT 'Metro Manila';
