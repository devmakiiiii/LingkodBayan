-- Add excerpt column to announcements table
-- This column provides a short summary for announcement previews

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS excerpt TEXT;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.announcements.excerpt IS 'Optional short summary/preview text for announcement cards';