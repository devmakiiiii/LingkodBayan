-- Add geolocation fields to complaints table
ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Create complaint messages table for Reply feature
CREATE TABLE IF NOT EXISTS public.complaint_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'reply', -- reply, system, action
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.complaint_messages
ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.complaint_messages
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.complaint_messages
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Enable RLS on complaint_messages
ALTER TABLE public.complaint_messages ENABLE ROW LEVEL SECURITY;

-- Helper functions that bypass RLS recursion when checking admin membership
CREATE OR REPLACE FUNCTION public.is_admin_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = target_user_id
    AND role IN ('admin', 'super_admin')
  )
  OR coalesce((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin'), false)
  OR coalesce((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'), false);
$$;

-- RLS Policies for complaint_messages
DROP POLICY IF EXISTS "Users can view messages for their complaints" ON public.complaint_messages;
DROP POLICY IF EXISTS "Users can create messages for their complaints" ON public.complaint_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.complaint_messages;
DROP POLICY IF EXISTS "Admins can create messages" ON public.complaint_messages;

CREATE POLICY "Users can view messages for their complaints" ON public.complaint_messages
  FOR SELECT USING (
    recipient_user_id = auth.uid()
    OR
    complaint_id IN (
      SELECT complaints.id FROM public.complaints 
      WHERE complaints.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
    OR
    sender_id = auth.uid()
  );

CREATE POLICY "Users can create messages for their complaints" ON public.complaint_messages
  FOR INSERT WITH CHECK (
    complaint_id IN (
      SELECT complaints.id FROM public.complaints 
      WHERE complaints.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
    AND sender_id = auth.uid()
    AND recipient_user_id IS NOT NULL
  );

CREATE POLICY "Admins can view all messages" ON public.complaint_messages
  FOR SELECT USING (
    public.is_admin_user(auth.uid())
  );

CREATE POLICY "Admins can create messages" ON public.complaint_messages
  FOR INSERT WITH CHECK (
    public.is_admin_user(auth.uid())
  );

UPDATE public.complaint_messages cm
SET recipient_user_id = r.user_id
FROM public.complaints c
JOIN public.residents r ON r.id = c.resident_id
WHERE cm.complaint_id = c.id
  AND cm.recipient_user_id IS NULL;

DROP POLICY IF EXISTS "Users can update their complaint messages" ON public.complaint_messages;

CREATE POLICY "Users can update their complaint messages" ON public.complaint_messages
  FOR UPDATE USING (
    recipient_user_id = auth.uid()
    OR
    sender_id = auth.uid()
    OR complaint_id IN (
      SELECT complaints.id FROM public.complaints
      WHERE complaints.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
    OR
    sender_id = auth.uid()
    OR complaint_id IN (
      SELECT complaints.id FROM public.complaints
      WHERE complaints.resident_id IN (
        SELECT id FROM public.residents WHERE residents.user_id = auth.uid()
      )
    )
  );

-- Update complaints status enum
-- Add new status values if not exists
-- Status values: open, under_investigation, resolved, dismissed
