-- Run in Supabase → SQL Editor (after fix-profiles-rls-complete.sql so is_staff() exists)
-- Creates cohorts table if missing + RLS so admins can manage cohorts from the app.

CREATE TABLE IF NOT EXISTS public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  course text,
  start_date date,
  end_date date,
  status text DEFAULT 'Upcoming',
  max_students int,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cohorts_name_lower ON public.cohorts (lower(name));

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can read cohort names (students need this for UI)
DROP POLICY IF EXISTS "cohorts_select_all" ON public.cohorts;
CREATE POLICY "cohorts_select_all"
ON public.cohorts FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "cohorts_insert_staff" ON public.cohorts;
CREATE POLICY "cohorts_insert_staff"
ON public.cohorts FOR INSERT TO authenticated
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "cohorts_update_staff" ON public.cohorts;
CREATE POLICY "cohorts_update_staff"
ON public.cohorts FOR UPDATE TO authenticated
USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "cohorts_delete_staff" ON public.cohorts;
CREATE POLICY "cohorts_delete_staff"
ON public.cohorts FOR DELETE TO authenticated
USING (public.is_staff());

-- Let students read cohort names (e.g. display on profile) — optional