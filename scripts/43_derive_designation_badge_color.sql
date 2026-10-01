-- Migration 43: Derive designation badge color from the category
--
-- `designations.badge_color` was a hand-picked color stored per designation.
-- Two problems:
--
--   1. It invited arbitrary values. The seeded barangay set was four unrelated
--      shades (dark green #166534, green #28A745, teal #0f766e, sky blue
--      #0ea5e9) implying a distinction between Captain and Treasurer that does
--      not exist in practice. Nothing told an admin which color to pick, so any
--      value from the swatch control was equally "correct".
--
--   2. Nothing on the citizen-facing side used it. Only two admin tables render
--      a badge; the public directory (app/citizen/offices) reads from
--      charter_services and has never shown a color. So the column was
--      maintained by hand for the benefit of two admin tables.
--
-- The one distinction that IS real is category: SK officials are visually
-- distinct from barangay officials, and staff are neither. So the color is now
-- derived from the category in getDesignationBadgeColor() (lib/governance.ts)
-- and the column is dropped. The four barangay shades collapse to one honest
-- green, SK keeps the purple that genuinely separates it, staff keeps the gray.
--
-- This also removes the only NOT NULL, defaulted column the app had to supply
-- on every designation write, which is a class of insert failure this schema
-- has been bitten by before (see scripts/_check_schema.mjs).

ALTER TABLE public.designations
  DROP COLUMN IF EXISTS badge_color;