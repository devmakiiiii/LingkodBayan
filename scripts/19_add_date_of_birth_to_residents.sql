-- Migration 19: Add date_of_birth column to residents table
-- Adds date_of_birth DATE column to store resident's date of birth

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE INDEX IF NOT EXISTS idx_residents_date_of_birth ON public.residents (date_of_birth);