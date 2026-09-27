-- Migration 33: Durable rate limiting
--
-- The in-memory limiter in lib/rate-limit.ts resets whenever a serverless
-- instance cold-starts, so it cannot stop brute-force abuse of sensitive
-- endpoints (password reset, sign-up OTP) in production. This migration adds
-- a Postgres-backed limiter: an atomic SQL function performs the check inside
-- a single upsert so concurrent requests from different instances share one
-- counter.
--
-- The table has RLS enabled with NO policies — only the service-role key can
-- read or write it, and the SECURITY DEFINER function is revoked from
-- anon/authenticated so it can only be called from trusted server code.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_interval_seconds INTEGER,
  p_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_row public.rate_limits;
BEGIN
  INSERT INTO public.rate_limits (key, window_started_at, count, expires_at)
  VALUES (p_key, v_now, 1, v_now + make_interval(secs => p_interval_seconds))
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limits.expires_at <= v_now THEN 1
      ELSE public.rate_limits.count + 1
    END,
    window_started_at = CASE
      WHEN public.rate_limits.expires_at <= v_now THEN v_now
      ELSE public.rate_limits.window_started_at
    END,
    expires_at = CASE
      WHEN public.rate_limits.expires_at <= v_now
        THEN v_now + make_interval(secs => p_interval_seconds)
      ELSE public.rate_limits.expires_at
    END
  RETURNING * INTO v_row;

  -- Opportunistic cleanup so abandoned windows do not accumulate.
  DELETE FROM public.rate_limits
  WHERE expires_at < v_now - INTERVAL '1 day' AND key <> p_key;

  RETURN v_row.count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER)
  FROM public, anon, authenticated;
