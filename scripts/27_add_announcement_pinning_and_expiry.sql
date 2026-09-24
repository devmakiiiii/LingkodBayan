-- Migration 27: Announcement pinning and expiry
-- `pinned` keeps an important announcement at the top of the citizen feed.
-- `expires_at` hides time-bound notices automatically (e.g. a maintenance window),
-- so they do not linger on the dashboard once they stop applying.
--
-- No scheduled job is needed: migration 26's `published_at` doubles as the
-- publish schedule (a future value means "publish later"), and visibility is
-- resolved at read time.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.announcements.pinned IS 'Pins the announcement above unpinned ones in the citizen feed';
COMMENT ON COLUMN public.announcements.expires_at IS 'Optional time after which the announcement is hidden from residents (NULL = never expires)';

-- Supports the citizen feed: visible rows, pinned first, newest publish first.
CREATE INDEX IF NOT EXISTS announcements_feed_idx
  ON public.announcements (is_published, pinned DESC, published_at DESC);
