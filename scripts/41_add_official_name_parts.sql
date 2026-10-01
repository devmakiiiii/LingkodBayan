-- Migration 41: Structured name parts on officials
--
-- The officials table stored a single `full_name` string, while every other
-- person record in the system (residents, accounts) keeps first/middle/last.
-- One string cannot be alphabetised by surname or printed as "Dela Cruz, Juan",
-- and splitting it later is unreliable because Filipino surnames are often
-- compound ("Dela Cruz", "Macapagal", "Santos Benitez").
--
-- `full_name` is kept as the display column every existing query reads: the app
-- composes it from the parts on save, so no display, report or sort code needs
-- to change. The new columns are nullable on purpose - existing rows are NOT
-- parsed automatically (a wrong guess is worse than a blank), they simply stay
-- empty until an admin re-saves the record from the Edit dialog.
--
-- Note: unlike residents (who keep a full `middle_name`), officials are
-- recorded with a middle INITIAL only, hence `middle_initial`.

ALTER TABLE public.officials
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS middle_initial TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS suffix TEXT;

COMMENT ON COLUMN public.officials.first_name IS 'Given name. NULL for rows created before migration 41.';
COMMENT ON COLUMN public.officials.middle_initial IS 'Middle initial only, stored as a capitalised letter with a period (e.g. S.). Officials are recorded with initials, not full middle names.';
COMMENT ON COLUMN public.officials.last_name IS 'Family name / surname. NULL for rows created before migration 41.';
COMMENT ON COLUMN public.officials.suffix IS 'Name extension such as Jr. or III, optional.';