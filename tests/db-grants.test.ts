/**
 * Static guard for the "permission denied for table ..." regression.
 *
 * The live project's `postgres` default ACL had no SELECT/INSERT/UPDATE/DELETE
 * for `authenticated`, so PostgREST rejected every request before RLS was
 * evaluated. `0002_restore_authenticated_grants.sql` restores only that missing
 * privilege layer. These checks stop anyone from deleting the grants, disabling
 * RLS, or widening the fix to `anon` / `service_role`.
 * They do not touch the production database.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MIGRATION = readFileSync(
  join(ROOT, "supabase/migrations/0002_restore_authenticated_grants.sql"),
  "utf8",
);

test("authenticated role has DML grants on all public tables", () => {
  assert.match(
    MIGRATION,
    /GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+authenticated/i,
  );
});

test("tables created later keep the same grants", () => {
  assert.match(
    MIGRATION,
    /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public\s+GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+TABLES\s+TO\s+authenticated/i,
  );
});

test("the fix never disables RLS, drops policies or widens API-role access", () => {
  assert.doesNotMatch(MIGRATION, /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  assert.doesNotMatch(MIGRATION, /DROP\s+POLICY/i);
  assert.doesNotMatch(MIGRATION, /GRANT\s+ALL\s+PRIVILEGES/i);
  assert.doesNotMatch(MIGRATION, /\bTO\s+anon\b/i);
  assert.doesNotMatch(MIGRATION, /\bTO\s+service_role\b/i);
});
