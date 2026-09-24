-- Migration 28: Retire the 'inactive' officials status
-- The admin UI no longer exposes active/inactive: officials are either
-- current (active) or archived. Fold any legacy 'inactive' rows into
-- 'active' and tighten the CHECK constraint to ('active', 'archived').

UPDATE public.officials
SET status = 'active'
WHERE LOWER(TRIM(status)) = 'inactive';

ALTER TABLE public.officials
  DROP CONSTRAINT IF EXISTS officials_status_check;

ALTER TABLE public.officials
  ADD CONSTRAINT officials_status_check
  CHECK (status IN ('active', 'archived'));