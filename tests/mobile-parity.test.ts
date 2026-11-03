/**
 * Web <=> shared core <=> Android/iOS parity guards.
 *
 * Guarantees that the website and the mobile app execute the SAME pure engine,
 * that the canonical attendance rules were not changed, and that both adapters
 * generate identical deterministic source keys.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeSchedule } from "../lib/academic/engine.ts";
import { summarize as webSummarize } from "../lib/attendance/engine.ts";
import { summarize as sharedSummarize } from "../packages/attendly-core/src/attendance.ts";
import { computeSchedule as sharedCompute } from "../packages/attendly-core/src/engine.ts";
import { toCourseInserts, toRuleInserts, toEventInserts, buildEngineInput } from "../lib/academic/bridge.ts";
import { buildCourses } from "../lib/academic/grid.ts";
import { interpretTimetableGrid } from "../lib/academic/grid.ts";
import {
  buildMobileEngineInput, computeMobileExpectedCounts, mobileDayExceptions,
  buildMobilePersistencePayload, fetchExpectedClassCounts, combineDateTimeMobile,
  type MobileCourseRow, type MobileRuleRow, type MobileDayRow, type MobileSemesterRow,
} from "../apps/mobile/src/lib/academic/structure.ts";
import type { ExtractedSlot } from "../lib/academic/types.ts";
import type { CourseRow, TimetableRuleRow, SemesterRow } from "../lib/types.ts";
import type { DayException } from "../lib/academic/types.ts";
import { replacementDayException, additionalClassException, cancellationException } from "../lib/academic/calendar.ts";
import { combineDateTime } from "../lib/dates.ts";

// Persisted identity (courseSourceKey) used by BOTH adapters.
const A = "sem:course:code:MA301";
const B = "sem:course:code:PHY301";
const C = "sem:course:code:CS302";

const slot = (overrides: Partial<ExtractedSlot> = {}): ExtractedSlot => ({
  id: "s", raw: "raw", courseName: "Mathematics", courseCode: "MA301", weekday: 1,
  startTime: "09:00", endTime: "10:00", sessionType: "lecture", faculty: null,
  room: null, confidence: "high", issues: [], needsReview: false, ...overrides,
});

const EXCEPTIONS: DayException[] = [
  { id: "holiday", date: "2026-01-12", priority: 50, type: "holiday", scope: "full_day", followsWeekday: null, courseKeys: [], startTime: null, endTime: null, extraRule: null, rescheduled: false, confirmed: true },
  { id: "exam", date: "2026-01-27", priority: 50, type: "exam", scope: "full_day", followsWeekday: null, courseKeys: [], startTime: null, endTime: null, extraRule: null, rescheduled: false, confirmed: true },
  replacementDayException("rep", "2026-01-17", 1),
  additionalClassException("extra", B, "2026-01-11", "16:00", "17:00"),
  cancellationException("cancel", "2026-01-26", A, "09:00", "10:00", false),
];

const webCourses: CourseRow[] = [
  { id: "c-a", semester_id: "sem", name: "Mathematics", code: "MA301", category: "theory", attendance_target: null, calculation_mode: "class_count" as const, color: "#38B8A5", created_at: "2026-01-01T00:00:00Z", source_key: "sem:course:code:MA301" },
  { id: "c-b", semester_id: "sem", name: "Physics", code: "PHY301", category: "theory", attendance_target: null, calculation_mode: "class_count" as const, color: "#2C9E8E", created_at: "2026-01-01T00:00:00Z", source_key: "sem:course:code:PHY301" },
  { id: "c-c", semester_id: "sem", name: "Programming Lab", code: "CS302", category: "lab", attendance_target: null, calculation_mode: "class_count" as const, color: "#5CCABB", created_at: "2026-01-01T00:00:00Z", source_key: "sem:course:code:CS302" },
];
const mobileCourses: MobileCourseRow[] = webCourses.map((row) => ({
  id: row.id, semester_id: row.semester_id, name: row.name, code: row.code, source_key: row.source_key,
}));

const webRules: TimetableRuleRow[] = [
  { id: "r1", semester_id: "sem", course_id: "c-a", weekday: 1, starts_at: "09:00", ends_at: "10:00", location: null, valid_from: null, valid_until: null, created_at: "2026-01-01T00:00:00Z", session_type: "lecture", source_key: "sem:rule:code:MA301:1:09:00:lecture:base" },
  { id: "r2", semester_id: "sem", course_id: "c-a", weekday: 3, starts_at: "11:00", ends_at: "12:00", location: null, valid_from: null, valid_until: null, created_at: "2026-01-01T00:00:00Z", session_type: "lecture", source_key: "sem:rule:code:MA301:3:11:00:lecture:base" },
  { id: "r3", semester_id: "sem", course_id: "c-a", weekday: 1, starts_at: "14:00", ends_at: "15:00", location: null, valid_from: null, valid_until: null, created_at: "2026-01-01T00:00:00Z", session_type: "tutorial", source_key: "sem:rule:code:MA301:1:14:00:tutorial:base" },
  { id: "r4", semester_id: "sem", course_id: "c-c", weekday: 5, starts_at: "14:00", ends_at: "17:00", location: null, valid_from: null, valid_until: null, created_at: "2026-01-01T00:00:00Z", session_type: "lab", source_key: "sem:rule:code:CS302:5:14:00:lab:base" },
  { id: "r5", semester_id: "sem", course_id: "c-b", weekday: 2, starts_at: "10:00", ends_at: "11:00", location: null, valid_from: null, valid_until: null, created_at: "2026-01-01T00:00:00Z", session_type: "lecture", source_key: "sem:rule:code:PHY301:2:10:00:lecture:base" },
];
const mobileRules: MobileRuleRow[] = webRules.map((row) => ({
  id: row.id, semester_id: row.semester_id, course_id: row.course_id, weekday: row.weekday,
  starts_at: row.starts_at, ends_at: row.ends_at, session_type: row.session_type as MobileRuleRow["session_type"],
  source_key: row.source_key,
}));
const mobileDays: MobileDayRow[] = EXCEPTIONS.map((item, index) => ({
  id: `d${index}`, semester_id: "sem", day: item.date,
  kind: item.type === "holiday" ? "holiday" : "instructional",
  source_key: `sem:exception:${item.date}:${item.id}`,
  extra_data: { exceptions: [item] }, confirmed: true,
}));
const webSemester: SemesterRow = {
  id: "sem", owner_id: "u1", group_id: null, name: "Odd Semester 2026", institution: null,
  start_date: "2026-01-05", end_date: "2026-01-31", attendance_target: 75,
  prediction_mode: "fixed" as const, created_at: "2026-01-01T00:00:00Z",
};
const mobileSemester: MobileSemesterRow = {
  id: "sem", start_date: "2026-01-05", end_date: "2026-01-31", attendance_target: 75,
};
const webDays = mobileDays.map((row) => ({
  id: row.id, semester_id: "sem", day: row.day,
  kind: row.kind as "holiday" | "instructional", title: null, notes: null,
  source_key: row.source_key, extra_data: row.extra_data, confirmed: true,
  follows_weekday: null, closure_scope: "full_day" as const,
  start_time: null, end_time: null, exception_type: null,
})) as unknown as Parameters<typeof buildEngineInput>[0]["academicDays"];

test("web shims contain no business logic (single source of truth)", () => {
  for (const name of ["types", "dates", "text", "grid", "calendar", "engine", "idempotency", "index"]) {
    const source = readFileSync(new URL(`../lib/academic/${name}.ts`, import.meta.url), "utf8");
    assert.match(source, /export \* from "\.\.\/\.\.\/packages\/attendly-core\/src\//, `${name}.ts must re-export the shared core`);
    assert.doesNotMatch(source, /\bfunction\b|\bconst\b\s+\w+\s*=/, `${name}.ts must not define logic`);
  }
  const canonical = readFileSync(new URL("../lib/attendance/engine.ts", import.meta.url), "utf8");
  const shared = readFileSync(new URL("../packages/attendly-core/src/attendance.ts", import.meta.url), "utf8");
  assert.equal(shared, canonical, "shared attendance rules are a verbatim copy — no rule change");
  const sessions = [
    { status: "present" as const, lifecycle: "completed" as const },
    { status: "absent" as const, lifecycle: "completed" as const },
    { status: "excused" as const, lifecycle: "completed" as const },
    { status: "unmarked" as const, lifecycle: "scheduled" as const },
  ];
  const input = { sessions, targetPercent: 75, mode: "class_count" as const, futureUnits: 4 };
  assert.deepEqual(sharedSummarize(input), webSummarize(input));
});

test("web, shared core and mobile compute IDENTICAL sessions and counts", () => {
  const fromWeb = computeSchedule(buildEngineInput({
    semester: webSemester, courses: webCourses, rules: webRules, academicDays: webDays,
  }));
  const fromShared = sharedCompute(buildMobileEngineInput({
    semester: mobileSemester, courses: mobileCourses, rules: mobileRules, academicDays: mobileDays,
  }));
  const fromMobile = computeMobileExpectedCounts({
    semester: mobileSemester, courses: mobileCourses, rules: mobileRules, academicDays: mobileDays,
  });
  assert.deepEqual(fromShared, fromWeb);
  assert.deepEqual(fromMobile, fromWeb);
  assert.equal(fromMobile.sessions.length, 20);
  assert.equal(fromMobile.totals.scheduled, 19);
  assert.equal(fromMobile.totals.cancelled, 1);
  assert.deepEqual(fromMobile.countsByCourse.map((item) => item.scheduled), [11, 4, 4]);
});

test("mobile day exceptions round-trip the same extra_data payload as web", () => {
  assert.equal(mobileDayExceptions(mobileDays).length, EXCEPTIONS.length);
  const web = computeSchedule({ semesterStart: "2026-01-05", semesterEnd: "2026-01-31",
    rules: [], exceptions: EXCEPTIONS, courses: [], targetPercent: 75 });
  const mobile = computeSchedule({ semesterStart: "2026-01-05", semesterEnd: "2026-01-31",
    rules: [], exceptions: mobileDayExceptions(mobileDays), courses: [], targetPercent: 75 });
  assert.equal(mobile.warnings.length, web.warnings.length);
  assert.equal(mobile.totals.scheduled, web.totals.scheduled);
  assert.equal(combineDateTimeMobile("2026-01-05", "09:00"), combineDateTime("2026-01-05", "09:00"));
});

test("web and mobile persistence builders agree on every deterministic source key", () => {
  const detected = buildCourses([
    slot({ id: "1", weekday: 1 }),
    slot({ id: "2", weekday: 3, startTime: "11:00", endTime: "12:00" }),
    slot({ id: "3", courseName: "Physics", courseCode: "PHY301", weekday: 2, startTime: "10:00", endTime: "11:00" }),
  ]);
  const ids = new Map<string, string>([
    ["sem:course:code:MA301", "c-a"], ["sem:course:code:PHY301", "c-b"],
  ]);
  const webCourseRows = toCourseInserts("sem", detected, ["#A", "#B"], "parity.csv");
  const webRuleRows = toRuleInserts("sem", detected, ids, "2026-01-05", "2026-01-31");
  const result = computeMobileExpectedCounts({
    semester: mobileSemester, courses: mobileCourses, rules: mobileRules, academicDays: mobileDays,
  });
  const payload = buildMobilePersistencePayload({
    semesterId: "sem", userId: "u1", importId: null,
    courses: detected, result, courseIdBySourceKey: ids, source: "parity.csv",
  });
  assert.deepEqual(payload.courses.map((row) => row.source_key), webCourseRows.map((row) => row.source_key));
  assert.deepEqual(payload.rules.map((row) => row.source_key).sort(), webRuleRows.map((row) => row.source_key).sort());
  const webEvents = toEventInserts(result, {
    semesterId: "sem", userId: "u1", importId: null,
    courseIdByKey: new Map([[A, "c-a"], [B, "c-b"], [C, "c-c"]]),
    courseNameByKey: new Map([[A, "Mathematics"], [B, "Physics"], [C, "Programming Lab"]]),
  });
  assert.deepEqual(payload.events.map((row) => row.source_key), webEvents.map((row) => row.source_key));
  assert.deepEqual(payload.events.map((row) => row.status), webEvents.map((row) => row.status));
  assert.deepEqual(payload.events.map((row) => row.starts_at), webEvents.map((row) => row.starts_at));
});

test("mobile RPC uses the shared security-invoker function, never a service role", async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: [{ course_id: "c-a", scheduled: 3, cancelled: 0, rescheduled: 0, attended: 1, absent: 0, excused: 0, pending: 2, attended_percent: 100 }], error: null };
    },
  };
  const rows = await fetchExpectedClassCounts(client, "sem", "2026-01-05", "2026-01-31");
  assert.equal(rows.length, 1);
  assert.deepEqual(calls[0], { name: "expected_class_counts", args: {
    p_semester: "sem", p_from: "2026-01-05", p_to: "2026-01-31",
  } });
  const failing = { rpc: async () => ({ data: null, error: { message: "denied" } }) };
  await assert.rejects(() => fetchExpectedClassCounts(failing, "sem"), /denied/);
  const source = readFileSync(new URL("../apps/mobile/src/lib/academic/structure.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /service_role|SERVICE_ROLE|secret/i);
});

test("timetable interpretation is identical from the shared package and web shims", () => {
  const grid = [
    ["Time", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    ["9:00-10:00", "MA301 Mathematics", "", "PHY301 Physics", "", "", ""],
    ["14:00-17:00", "", "", "", "", "CS302 Programming Lab", ""],
  ];
  const viaWeb = interpretTimetableGrid(grid);
  const viaShared = (() => {
    // The mobile app calls the package index directly.
    return import("../packages/attendly-core/src/index.ts");
  })();
  return viaShared.then((core) => {
    const viaPackage = core.interpretTimetableGrid(grid);
    assert.deepEqual(viaPackage, viaWeb);
    assert.equal(viaPackage.courses.length, 3);
  });
});
