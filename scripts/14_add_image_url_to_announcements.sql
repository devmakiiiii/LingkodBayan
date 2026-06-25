-- Add image_url column to announcements table
-- This column is referenced by the announcements feature but may be missing in existing databases

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.announcements.image_url IS 'Optional image URL for announcement banner/image';