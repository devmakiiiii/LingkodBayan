-- Allow service requests to be assigned to barangay officials so workload
-- balancing covers both complaints and requests (complaints already have
-- assigned_official_id via migration 11).
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS assigned_official_id UUID REFERENCES public.officials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS requests_assigned_official_id_idx ON public.requests(assigned_official_id);
