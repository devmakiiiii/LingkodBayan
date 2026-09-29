-- Migration 35: Durable OCR verification job store
-- The in-memory job store in lib/verification-jobs.ts is a process-local Map,
-- so on a multi-instance deploy (serverless, or `next start` behind a load
-- balancer) the /status poll can reach an instance that never saw the upload
-- and the resident's verification hangs or fails even though OCR succeeded.
-- This migration backs the store with Postgres so any instance can read a job.
--
-- RLS is enabled with NO policies: only the service-role key (which bypasses
-- RLS) can read or write these rows. The endpoints all use the admin client, so
-- no resident or admin needs direct access, and OCR results contain PII read
-- off a government ID — keeping the table unreachable to `authenticated` is
-- deliberate.
--
-- `expires_at` lets the cleanup below reap rows; an upload that is never polled
-- does not accumulate forever.

CREATE TABLE IF NOT EXISTS public.verification_ocr_jobs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour')
);

-- The status endpoint looks jobs up by id; the owner check happens in the route.
CREATE INDEX IF NOT EXISTS idx_verification_ocr_jobs_user
  ON public.verification_ocr_jobs (user_id, created_at DESC);

ALTER TABLE public.verification_ocr_jobs ENABLE ROW LEVEL SECURITY;

-- Reap expired jobs on write. Cheap, and bounded by the one-hour expiry, so the
-- table stays small without needing a scheduled job.
--
-- The trigger matters: `expires_at` alone does not delete anything, and these
-- rows hold OCR output read off a resident's government ID. Without this the
-- table grows without bound and PII is retained indefinitely, which is the
-- opposite of what the `expires_at` column implies.
--
-- SECURITY DEFINER is required: the DELETE runs as the function owner (postgres)
-- rather than the caller's role, so it is not subject to the RLS enabled above.
--
-- This is the body, kept as RETURNS VOID so it stays callable directly — the
-- Supabase SQL Editor's "Run RPC" panel exposes it as
-- /rpc/prune_verification_ocr_jobs, which makes the sweep a one-click manual
-- recovery if the trigger is ever dropped.
CREATE OR REPLACE FUNCTION public.prune_verification_ocr_jobs()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.verification_ocr_jobs
  WHERE expires_at < now() - INTERVAL '1 day';
$$;

REVOKE ALL ON FUNCTION public.prune_verification_ocr_jobs()
  FROM public, anon, authenticated;

-- The trigger wrapper, which is what actually reaps rows on write.
--
-- It MUST be RETURNS TRIGGER: Postgres rejects a CREATE TRIGGER whose target
-- function returns anything else (42P17: "function ... must return type
-- trigger"). So the work lives in the VOID function above and this thin wrapper
-- just calls it and returns NULL, which is what an AFTER trigger must do.
--
-- Statement-level on purpose. A job is inserted once then updated once or twice
-- while the resident polls; a row-level trigger would run the DELETE a few extra
-- times per verification for no benefit, since the table is bounded by the
-- expiry either way.
CREATE OR REPLACE FUNCTION public.trg_prune_verification_ocr_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.prune_verification_ocr_jobs();
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_prune_verification_ocr_jobs()
  FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prune_verification_ocr_jobs
  ON public.verification_ocr_jobs;

CREATE TRIGGER trg_prune_verification_ocr_jobs
  AFTER INSERT OR UPDATE ON public.verification_ocr_jobs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_prune_verification_ocr_jobs();