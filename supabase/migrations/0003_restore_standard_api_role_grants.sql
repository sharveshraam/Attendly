-- Attendly: finish clearing the privilege layer for EVERY API role.
--
-- 0002 restored `authenticated` only. That fixed the signed-in pages, but the
-- `postgres` default ACL was still `anon=Dxtm` and `service_role=Dxtm` on all
-- 19 public tables. Consequences of leaving it half-fixed:
--   * an unauthenticated request (publishable key, `anon` role) hit
--     `permission denied for table …` instead of an empty, RLS-filtered result
--     — e.g. while a session is being restored or on an auth callback;
--   * `service_role` could not perform any table operation at all, so any
--     server-side/admin maintenance on this project would fail.
--
-- This restores the standard Supabase baseline (`supabase_admin`'s default ACL
-- in this same project is `anon=arwdDxtm, authenticated=arwdDxtm,
-- service_role=arwdDxtm`). It is privilege-only and idempotent:
--   * RLS stays enabled on all 19 tables.
--   * All 42 policies stay exactly as written; every one is `to authenticated`.
--   * `anon` therefore still sees and can write ZERO rows — the grant only
--     removes the misleading permission error; it grants no data.
--   * `service_role` bypasses RLS by design, as it does on every standard
--     Supabase project. No service-role key is used by the website, the mobile
--     app, or this repository.
--   * No table, column, policy, row, Auth, Storage or Edge Function is changed.
--
-- Applied to the live project on 2026-11-03.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO anon, authenticated, service_role;

GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES
  TO anon, authenticated, service_role;
