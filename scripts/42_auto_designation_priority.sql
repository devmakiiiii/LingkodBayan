-- Migration 42: Rename `priority_order` to `rank` and make it automatic
--
-- Two problems with `designations.priority_order`:
--
--   1. It was a hand-typed integer that only affected display sorting, so it
--      drifted and duplicates inside a category were silently accepted.
--   2. The name collided with two unrelated columns in this schema -
--      `requests.priority` and `complaints.priority_level` - which mean triage
--      urgency on a specific item, not the standing rank of an office. A
--      column named `rank` cannot be mistaken for either.
--
-- The rename is folded into this migration rather than shipped separately so a
-- deployment applies it in one step. `RENAME COLUMN` also carries the existing
-- index across automatically; it is renamed afterwards to match.
--
-- Steps:
--   1. Rename the column and the index that references it.
--   2. Renumber existing rows densely per category, preserving the current
--      relative order (old rank, then name). Gaps collapse; relative ranking
--      is unchanged.
--   3. Enforce UNIQUE (category, rank) so ties cannot be created.
--
-- Numbering is per category on purpose: a Barangay Captain and an SK
-- Chairperson are both rank 1, because they head separate groups that are
-- never compared against each other. Officials are sorted within a category.
--
-- New designations get max(rank) + 1 for their category, assigned by the app
-- (see getNextRank in lib/governance.ts). An admin may still type an explicit
-- number to override.

-- ─────────────────────────────────────────────────────────────────────────────
-- DIAGNOSTIC (read-only, safe to run at any time)
--
-- Paste this on its own to confirm what state the table is actually in. The
-- RENAME is transactional, so a failure either leaves the column fully renamed
-- or fully untouched - never half done.
--
-- Expect ONE row: the column is named "rank" (NOT NULL, default 999).
-- If it reports priority_order instead, the rename never ran.
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT column_name, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'designations'
--   AND column_name IN ('priority_order', 'rank');

-- 1a. Rename the column. `"rank"` is quoted because RANK is also a window
--     function name in Postgres (non-reserved, but quoting avoids ambiguity).
--
--     Postgres has no `RENAME COLUMN IF EXISTS`, so the rename is wrapped in a
--     DO block that checks pg_attribute first. This matters because
--     migrate.js emits the whole migration history and Supabase's SQL editor is
--     re-runnable: without the guard, a second run of an already-migrated
--     database aborts with `column "priority_order" does not exist` and takes
--     every statement after it down with it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.designations'::regclass
      AND attname = 'priority_order'
      AND NOT attisdropped
  ) THEN
    ALTER TABLE public.designations RENAME COLUMN priority_order TO "rank";
    RAISE NOTICE 'designations.priority_order renamed to rank';
  ELSE
    RAISE NOTICE 'designations.priority_order already renamed - skipping';
  END IF;
END
$$;

-- 1b. The 2026-06 index from migration 05 follows the renamed column; give it a
--     name that matches. Both directions are guarded so re-running is safe.
DROP INDEX IF EXISTS public.designations_priority_order_idx;
CREATE INDEX IF NOT EXISTS designations_rank_idx ON public.designations("rank" ASC, name ASC);

-- 2. Renumber densely per category, keeping the existing relative order.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY category
      ORDER BY "rank" ASC, name ASC
    ) AS new_rank
  FROM public.designations
)
UPDATE public.designations d
SET "rank" = r.new_rank,
    updated_at = NOW()
FROM ranked r
WHERE d.id = r.id
  AND d."rank" IS DISTINCT FROM r.new_rank;

-- 3. Enforce uniqueness within a category (idempotent).
DROP INDEX IF EXISTS public.designations_category_priority_order_key;
CREATE UNIQUE INDEX IF NOT EXISTS designations_category_rank_key
  ON public.designations(category ASC, "rank" ASC);

COMMENT ON COLUMN public.designations."rank" IS
  'Standing rank within the designation''s category (1 = highest). Unique per category; assigned as max+1 when the admin leaves the field blank. Not to be confused with requests.priority / complaints.priority_level, which are per-item triage urgency.';