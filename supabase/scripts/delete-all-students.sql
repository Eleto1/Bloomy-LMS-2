-- =============================================================================
-- Delete ALL student accounts (profiles + auth.users)
-- Run in: Supabase Dashboard → SQL Editor → New query
--
-- Why: Deleting only `profiles` in the app leaves `auth.users` rows, so the same
--      email cannot sign up again ("User already registered").
--
-- WARNING: Irreversible. Removes every user whose profile has role = 'student'.
--          Keep this file offline; do not commit secrets.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _student_ids_to_remove ON COMMIT DROP AS
SELECT id
FROM public.profiles
WHERE role = 'student';

DELETE FROM public.profiles
WHERE id IN (SELECT id FROM _student_ids_to_remove);

DELETE FROM auth.users
WHERE id IN (SELECT id FROM _student_ids_to_remove);

COMMIT;

-- Verify (should return 0 rows):
-- SELECT COUNT(*) FROM public.profiles WHERE role = 'student';
