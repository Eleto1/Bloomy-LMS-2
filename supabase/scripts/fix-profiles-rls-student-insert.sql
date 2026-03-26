-- Prefer: fix-profiles-rls-complete.sql (student self-service + admin list access)
-- =============================================================================
-- Fix: 403 / "row-level security policy" on profiles during student sign-up
-- (Add Student + Bulk CSV use the new user’s JWT to insert their profile row.)
--
-- Run once in: Supabase Dashboard → SQL Editor
-- Safe to re-run: drops our named policies then recreates them.
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Optional: let users read their own profile (often already present)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- If admins still cannot list students: add a separate admin policy (avoid
-- recursive checks that SELECT from profiles again). Common pattern is a
-- JWT claim or a small security-definer function — adjust to your project.
