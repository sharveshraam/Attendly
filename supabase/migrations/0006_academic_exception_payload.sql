-- Structured payload for one-off additions, cancellations and reschedules that
-- a student confirms in the academic-calendar review screen. Kept as JSON so
-- the existing `notes` text column stays human-readable for institutions.
-- Additive only: RLS, policies, grants and existing rows are unchanged.
alter table public.academic_days add column if not exists extra_data jsonb;
