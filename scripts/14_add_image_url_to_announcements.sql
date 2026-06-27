-- Add image_url and excerpt columns to announcements table
-- These columns are referenced by the announcements feature but may be missing in existing databases

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS excerpt TEXT;

-- Add comments explaining the columns
COMMENT ON COLUMN public.announcements.image_url IS 'Optional image URL for announcement banner/image';
COMMENT ON COLUMN public.announcements.excerpt IS 'Optional short summary/preview text for announcement cards';