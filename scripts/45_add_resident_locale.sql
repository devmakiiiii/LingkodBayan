-- =====================================================================
-- Migration 45: Resident locale preference for bilingual notifications
--
-- The citizen portal is bilingual (English/Tagalog). The browser persists the
-- locale in localStorage + the `lb-locale` cookie, but server code (SMS via
-- Semaphore, in-app notification titles/bodies) cannot read localStorage.
-- This column stores the resident's declared language preference so
-- `lib/notify.ts` can translate SMS-eligible notifications server-side
-- before sending them.
--
-- Values: 'en' | 'tl'. Defaults to 'en'; the portal's locale toggle writes
-- the resident's choice here via PATCH /api/citizen/profile. Unknown values
-- are normalized to 'en' at read time by `normalizeLocale()` in lib/i18n.ts.
-- =====================================================================

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'residents_locale_check'
  ) THEN
    ALTER TABLE public.residents
      ADD CONSTRAINT residents_locale_check CHECK (locale IN ('en', 'tl'));
  END IF;
END
$$;

COMMENT ON COLUMN public.residents.locale IS
  'Citizen language preference (en|tl) for SMS and notification text; written by the portal locale toggle.';
