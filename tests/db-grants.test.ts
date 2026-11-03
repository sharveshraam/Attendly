/**
 * Static guard for the "permission denied for table ..." regression.
 *
 * The live project's `postgres` default ACL had no SELECT/INSERT/UPDATE/DELETE
 * for the API roles, so PostgREST rejected every request before RLS was
 * evaluated. `0002_restore_authenticated_grants.sql` restores the missing
 * privilege layer for `authenticated` (the minimal, signed-in-user fix);
 * `0003_restore_standard_api_role_grants.sql` finishes the cleanup by restoring
 * the standard Supabase baseline for `anon`, `authenticated` and `service_role`
 * on current AND future public tables/sequences.
 *
 * Both migrations are privilege-only. RLS stays enabled, all 42
 * `authenticated` policies stay unchanged, and no SQL in either file may
 * delete rows, drop tables, truncate data or disable RLS. `anon` has table
 * grants but zero policies, so it still sees and can write ZERO rows; the grant
 * only removes the misleading permission error. `service_role` bypasses RLS by
 * design, as on every standard Supabase project — no service-role key is used
 * by the website, the mobile app, or this repository.
 *
 * These checks do not touch the production database.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const AUTHENTICATED_FIX = readFileSync(
  join(ROOT, "supabase/migrations/0002_restore_authenticated_grants.sql"),
  "utf8",
);
const FULL_BASELINE = readFileSync(
  join(ROOT, "supabase/migrations/0003_restore_standard_api_role_grants.sql"),
  "utf8",
);
// `0002` documents the old ACL letters in a comment ("only TRUNCATE/…"), so
// strip line comments before asserting on executable SQL.
const stripSqlComments = (sql: string) =>
  sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
const MIGRATIONS = [AUTHENTICATED_FIX, FULL_BASELINE].map(stripSqlComments);

test("authenticated role has DML grants on all public tables", () => {
  assert.match(
    AUTHENTICATED_FIX,
    /GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+authenticated/i,
  );
});

test("tables created later keep the same grants", () => {
  assert.match(
    AUTHENTICATED_FIX,
    /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public\s+GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+TABLES\s+TO\s+authenticated/i,
  );
});

test("0002 stays the minimal, authenticated-only fix", () => {
  assert.doesNotMatch(AUTHENTICATED_FIX, /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  assert.doesNotMatch(AUTHENTICATED_FIX, /DROP\s+POLICY/i);
  assert.doesNotMatch(AUTHENTICATED_FIX, /GRANT\s+ALL\s+PRIVILEGES/i);
  assert.doesNotMatch(AUTHENTICATED_FIX, /\bTO\s+anon\b/i);
  assert.doesNotMatch(AUTHENTICATED_FIX, /\bTO\s+service_role\b/i);
});

test("0003 restores the standard baseline for every API role", () => {
  assert.match(
    FULL_BASELINE,
    /GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+anon\s*,\s*authenticated\s*,\s*service_role/i,
  );
  assert.match(
    FULL_BASELINE,
    /GRANT\s+USAGE\s*,\s*SELECT\s*,\s*UPDATE\s+ON\s+ALL\s+SEQUENCES\s+IN\s+SCHEMA\s+public\s+TO\s+anon\s*,\s*authenticated\s*,\s*service_role/i,
  );
  assert.match(
    FULL_BASELINE,
    /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public\s+GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+TABLES\s+TO\s+anon\s*,\s*authenticated\s*,\s*service_role/i,
  );
  assert.match(
    FULL_BASELINE,
    /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public\s+GRANT\s+USAGE\s*,\s*SELECT\s*,\s*UPDATE\s+ON\s+SEQUENCES\s+TO\s+anon\s*,\s*authenticated\s*,\s*service_role/i,
  );
});

test("grant migrations never disable RLS, drop policies, or delete data", () => {
  for (const migration of MIGRATIONS) {
    assert.doesNotMatch(migration, /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    assert.doesNotMatch(migration, /DROP\s+POLICY/i);
    assert.doesNotMatch(migration, /DROP\s+TABLE/i);
    assert.doesNotMatch(migration, /TRUNCATE\b/i);
    assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);
    assert.doesNotMatch(migration, /\bGRANT\s+ALL\s+PRIVILEGES\b/i);
  }
});
