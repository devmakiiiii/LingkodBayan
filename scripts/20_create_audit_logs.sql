-- Migration 20: Create audit_logs table
-- Records admin activity (who did what, when, and what changed) for the
-- Audit Trail Report on the admin Generated Reports page.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  admin_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_admin_id_idx ON public.audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_type_idx ON public.audit_logs (resource_type);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies are granted to anon or authenticated
-- roles on purpose: audit logs are written and read exclusively through
-- server-side API routes using the Supabase service role key, which bypasses RLS.
