-- Migration 26: Add published_at to announcements
-- Records the real publish time. Before this, the UI reused created_at, so a
-- draft written weeks earlier displayed a stale "Published on" date the moment
-- it went live. Cleared back to NULL when an announcement is unpublished.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.announcements.published_at IS 'When the announcement was most recently published; NULL while it is a draft';

-- Backfill: announcements that are already live were published when created.
UPDATE public.announcements
   SET published_at = created_at
 WHERE is_published = TRUE
   AND published_at IS NULL;

-- Supports the citizen feed (published newest-first) and admin status filters.
CREATE INDEX IF NOT EXISTS announcements_published_feed_idx
  ON public.announcements (is_published, published_at DESC NULLS LAST);
