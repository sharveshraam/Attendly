import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** The academic-structure wizard touches private workspace data; guard it. */
test("proxy protects every private app route, including /academic", () => {
  const source = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  const routes = [
    "/home", "/academic", "/calendar", "/courses", "/attendance", "/groups",
    "/productivity", "/analytics", "/assistant", "/settings", "/notifications", "/onboarding",
  ];
  for (const route of routes) {
    assert.ok(source.includes(`path.startsWith("${route}")`), `${route} must require authentication`);
  }
  assert.ok(source.includes("auth.getUser()"), "JWT must be validated, not just read from a cookie");
});
