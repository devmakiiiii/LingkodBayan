ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS priority_level TEXT DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS assigned_official_id UUID REFERENCES public.officials(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

CREATE INDEX IF NOT EXISTS complaints_priority_level_idx ON public.complaints(priority_level);
CREATE INDEX IF NOT EXISTS complaints_assigned_official_id_idx ON public.complaints(assigned_official_id);

UPDATE public.complaints
SET tracking_number = COALESCE(tracking_number, 'RPT-' || UPPER(SUBSTRING(id::text, 1, 8)))
WHERE tracking_number IS NULL;