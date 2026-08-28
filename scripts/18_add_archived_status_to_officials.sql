-- Migration 18: Add 'archived' status to officials table
-- Allows soft-deleting (archiving) officials instead of hard-deleting them.

ALTER TABLE public.officials
  DROP CONSTRAINT IF EXISTS officials_status_check;

ALTER TABLE public.officials
  ADD CONSTRAINT officials_status_check
  CHECK (status IN ('active', 'inactive', 'archived'));
