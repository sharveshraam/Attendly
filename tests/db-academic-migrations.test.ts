/**
 * Static guards for the additive academic-structure migrations (0004–0006).
 * These never touch the live database; they prevent a future edit from quietly
 * turning a schema extension into a destructive migration or an RLS rewrite.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (name: string) => readFileSync(join(ROOT, "supabase/migrations", name), "utf8");
const strip = (sql: string) => sql.split("\n").map((line) => line.replace(/--.*$/, "")).join("\n");
const CORE = strip(read("0004_academic_structure.sql"));
const INDEX_FIX = strip(read("0005_academic_structure_upsert_indexes.sql"));
const PAYLOAD = strip(read("0006_academic_exception_payload.sql"));

test("0004 only ADDS columns/indexes and never changes policies or data", () => {
  assert.equal(/\bTRUNCATE\b/i.test(CORE), false);
  assert.equal(/\bDELETE\s+FROM\b/i.test(CORE), false);
  assert.equal(/\bDROP\s+TABLE\b/i.test(CORE), false);
  assert.equal(/\bALTER\s+TABLE[\s\S]*?\bDROP\s+COLUMN\b/i.test(CORE), false);
  assert.equal(/\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(CORE), false);
  assert.equal(/\b(CREATE|ALTER|DROP)\s+POLICY\b/i.test(CORE), false);
  assert.equal(/\bUPDATE\s+public\./i.test(CORE), false);
  // Every column change is additive and safe for existing rows.
  const alters = [...CORE.matchAll(/alter table[^;]+;/gi)].map((item) => item[0]);
  assert.ok(alters.length >= 20);
  for (const statement of alters) {
    assert.match(statement, /add column if not exists/i);
    assert.ok(/default|jsonb|text|boolean|smallint|time|integer|timestamptz|uuid|date/i.test(statement));
  }
});

test("0004 creates the RLS-safe, security-invoker expected_class_counts RPC", () => {
  assert.match(CORE, /create or replace function public\.expected_class_counts/);
  assert.match(CORE, /security invoker/);
  assert.match(CORE, /set search_path = ''/);
  assert.match(CORE, /auth\.uid\(\)/);
  assert.match(CORE, /grant execute on function public\.expected_class_counts[^;]+to authenticated, service_role/);
  assert.match(CORE, /revoke all on function public\.expected_class_counts[^;]+from public, anon/);
  // Canonical denominator and exclusions.
  assert.match(CORE, /mark in \('present','absent'\)/);
  assert.match(CORE, /mark = 'excused'/);
  assert.match(CORE, /mark = 'unmarked'/);
  assert.match(CORE, /status = 'cancelled'/);
  assert.match(CORE, /status = 'rescheduled'/);
});

test("0005 recreates the five unique source_key indexes WITHOUT a predicate", () => {
  const indexes = [
    "courses_semester_source_key_idx", "timetable_rules_semester_source_key_idx",
    "calendar_events_semester_source_key_idx", "academic_days_semester_source_key_idx",
    "document_uploads_owner_hash_idx",
  ];
  for (const name of indexes) {
    assert.ok(INDEX_FIX.includes(`drop index if exists public.${name}`), name);
    assert.match(INDEX_FIX, new RegExp(`create unique index if not exists ${name}[^;]+;`, "i"));
  }
  assert.equal(/\bwhere\b/i.test(INDEX_FIX), false, "partial indexes break PostgREST ON CONFLICT");
  assert.equal(/\b(delete|truncate|drop table)\b/i.test(INDEX_FIX), false);
});

test("0006 only adds the nullable extra_data jsonb column", () => {
  assert.match(PAYLOAD, /alter table public\.academic_days add column if not exists extra_data jsonb/i);
  assert.equal(/\b(delete|drop|truncate|update|revoke|grant)\b/i.test(PAYLOAD), false);
});
