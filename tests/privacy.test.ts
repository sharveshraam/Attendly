/**
 * Static privacy guards. The live backend has no service-role key available to
 * the browser and relies on RLS. These checks catch accidental regressions that
 * would expose one student's attendance to group members or bypass the owner
 * filter. They do not touch the production database.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

function filesUnder(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, directory))) {
    const path = join(directory, entry);
    const full = join(ROOT, path);
    if (statSync(full).isDirectory()) out.push(...filesUnder(path));
    else if (/\.(ts|tsx|js|mjs|html)$/.test(entry)) out.push(full);
  }
  return out;
}

test("no service-role key or privileged secret is referenced in browser code", () => {
  const files = [...filesUnder("app"), ...filesUnder("components"), ...filesUnder("lib"), ...filesUnder("hooks"), ...filesUnder("public")];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /service_role|SERVICE_ROLE|SUPABASE_SERVICE/i, file);
    assert.doesNotMatch(source, /NEXT_PUBLIC_[A-Z_]*(SECRET|PRIVATE|SERVICE)/i, file);
  }
});

test("attendance reads and writes are always scoped to the signed-in user", () => {
  const data = readFileSync(join(ROOT, "lib/data.ts"), "utf8");
  for (const match of data.matchAll(/from\(["']attendance_records["']\)([\s\S]{0,420})/g)) {
    assert.match(
      match[1],
      /\.eq\(["']user_id["']|user_id:\s*input\.user_id/,
      "attendance query must filter by user_id or write only the caller's own row",
    );
  }
});

test("group schedule functions never read attendance records", () => {
  const data = readFileSync(join(ROOT, "lib/data.ts"), "utf8");
  const start = data.indexOf("export async function fetchGroupEvents");
  assert.notEqual(start, -1, "fetchGroupEvents must exist");
  const end = data.indexOf("export async function", start + 10);
  const body = data.slice(start, end === -1 ? undefined : end);
  assert.doesNotMatch(body, /attendance_records/);
  assert.match(body, /from\(["']calendar_events["']\)/);
  assert.match(body, /\.eq\(["']group_id["']/);
});

test("group pages never load personal attendance rows or private analytics", () => {
  const dir = join(ROOT, "app/(app)/groups");
  for (const file of filesUnder("app/(app)/groups")) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /from\(["']attendance_records["']\)/, file);
    assert.doesNotMatch(source, /markAttendance|fetchAttendanceRecords/, file);
    for (const match of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*useWorkspace\(\)/g)) {
      assert.doesNotMatch(match[1], /\b(stats|sessions|records|overall|markAttendance)\b/, file);
    }
  }
  assert.ok(statSync(dir).isDirectory());
});

test("service worker never caches API, auth, navigation or cross-origin responses", () => {
  const sw = readFileSync(join(ROOT, "public/sw.js"), "utf8");
  assert.match(sw, /if \(isPrivateRequest\(url, request\)\) return;/);
  assert.match(sw, /\/api\//);
  assert.match(sw, /\/auth\//);
  assert.match(sw, /Authorization|Cookie/);
  assert.match(sw, /request\.mode === "navigate"/);
  assert.match(sw, /isStaticAsset\(url\)/);
  const privateGuard = sw.indexOf("if (isPrivateRequest(url, request)) return;");
  const staticGuard = sw.indexOf("if (isStaticAsset(url))");
  const cachePut = sw.indexOf("cache.put(request, copy)");
  assert.ok(privateGuard >= 0 && staticGuard > privateGuard && cachePut > staticGuard,
    "cache.put must be reachable only after private and static-asset guards");
});

test("client config only uses public publishable/anon keys", () => {
  const source = readFileSync(join(ROOT, "lib/data.ts"), "utf8") + readFileSync(join(ROOT, "lib/supabase/client.ts"), "utf8");
  assert.match(source, /NEXT_PUBLIC_SUPABASE_(URL|PUBLISHABLE_KEY|ANON_KEY)/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET/);
});
