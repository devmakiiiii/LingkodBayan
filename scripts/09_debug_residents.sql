-- DEBUG: Disable RLS temporarily to test if it's a permissions issue
-- RUN THIS IN SUPABASE SQL EDITOR

-- First, check what's in the residents table
SELECT COUNT(*) as total_residents FROM public.residents;

-- Check if any policies exist
SELECT * FROM pg_policies WHERE tablename = 'residents';

-- TEMPORARILY disable RLS to test
ALTER TABLE public.residents DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS after testing
-- ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;