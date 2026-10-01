CREATE TABLE IF NOT EXISTS public.designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('barangay', 'sk', 'staff')),
  priority_order INTEGER NOT NULL DEFAULT 999,
  badge_color TEXT NOT NULL DEFAULT '#28A745',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT designations_name_unique UNIQUE (name, category)
);

CREATE TABLE IF NOT EXISTS public.officials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  designation_id UUID NOT NULL REFERENCES public.designations(id) ON DELETE RESTRICT,
  contact_number TEXT,
  email TEXT,
  term_start DATE,
  term_end DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view designations" ON public.designations;
DROP POLICY IF EXISTS "Admins can manage designations" ON public.designations;
DROP POLICY IF EXISTS "Admins can view officials" ON public.officials;
DROP POLICY IF EXISTS "Admins can manage officials" ON public.officials;

CREATE POLICY "Admins can view designations" ON public.designations
  FOR SELECT USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can manage designations" ON public.designations
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can view officials" ON public.officials
  FOR SELECT USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can manage officials" ON public.officials
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- This index used to reference designations(priority_order). Migration 42
-- renames that column to "rank", which means this statement ERRORS on any
-- database where 42 has already run:
--     column "priority_order" does not exist
-- Since migrate.js emits the whole migration history and the SQL editor is
-- re-runnable, that abort killed the script before migration 42 was reached.
--
-- Guarded on the column's existence so this migration is safe on both a fresh
-- database (column is priority_order -> index created) and an already-migrated
-- one (column is "rank" -> skipped). Migration 42 creates the equivalent
-- designations_rank_idx, so no index is lost either way.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.designations'::regclass
      AND attname = 'priority_order'
      AND NOT attisdropped
  ) THEN
    CREATE INDEX IF NOT EXISTS designations_priority_order_idx
      ON public.designations(priority_order ASC, name ASC);
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS officials_designation_id_idx ON public.officials(designation_id);
CREATE INDEX IF NOT EXISTS officials_status_idx ON public.officials(status);
