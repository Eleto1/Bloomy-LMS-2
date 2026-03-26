-- =============================================================================
-- Complete profiles RLS for Bloomy LMS
-- Run in: Supabase Dashboard → SQL Editor (once, or after adjusting names)
--
-- Fixes:
-- 1) Students can insert/update/select their OWN row (sign-up + bulk import).
-- 2) Admins/instructors can SELECT (and update/delete) ALL profiles so the
--    Admin Students page and dashboard counts actually return data.
--
-- Why the list was empty: if only "select own row" exists, an admin only sees
-- their own profile row — not other students — so .eq('role','student') returns 0 rows.
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Bypasses RLS inside the function body so we can read profiles.role for the
-- current user without infinite recursion.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'instructor')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- --- Students (and any user): own row only -----------------------------------

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

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- --- Admin / instructor: full visibility ------------------------------------

DROP POLICY IF EXISTS "profiles_select_staff_all" ON public.profiles;
CREATE POLICY "profiles_select_staff_all"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "profiles_update_staff" ON public.profiles;
CREATE POLICY "profiles_update_staff"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "profiles_delete_staff" ON public.profiles;
CREATE POLICY "profiles_delete_staff"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_staff());

-- Optional: staff-created rows (only if you INSERT profiles while logged in as admin)
-- DROP POLICY IF EXISTS "profiles_insert_staff" ON public.profiles;
-- CREATE POLICY "profiles_insert_staff"
-- ON public.profiles FOR INSERT TO authenticated
-- WITH CHECK (public.is_staff());
