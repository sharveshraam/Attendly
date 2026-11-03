-- Attendly: restore the missing table-level privileges for the authenticated
-- API role. Fixes "permission denied for table semesters" (and the same error
-- on all other pages) in BOTH the website and the mobile app, which share this
-- project.
--
-- Root cause: all 19 public tables have RLS enabled and 42 owner/group-scoped
-- policies, but `ALTER DEFAULT PRIVILEGES FOR ROLE postgres` in this project
-- had revoked SELECT/INSERT/UPDATE/DELETE from the API roles. The resulting
-- relacl was `authenticated=Dxtm/postgres` (only TRUNCATE/REFERENCES/TRIGGER/
-- MAINTAIN). PostgREST therefore rejected every request *before* evaluating
-- RLS, regardless of which user was signed in.
--
-- This migration changes ONLY the privilege layer:
--   * RLS stays enabled on every table.
--   * Every existing policy stays exactly as it is.
--   * Only `authenticated` (the role all 42 policies target) receives DML.
--   * `anon` and `service_role` are intentionally left as they were.
--
-- Safe to re-run: GRANT and ALTER DEFAULT PRIVILEGES are idempotent.
-- Applied to the live project on 2026-11-03 as Supabase migration
-- 20261103103452_restore_authenticated_table_grants.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Also covers views/materialised views/foreign tables and any sequences.
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Tables created later by postgres must not reintroduce the same breakage.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO authenticated;
