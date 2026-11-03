import test from "node:test";
import assert from "node:assert/strict";
import { generateSessions, diffTimetables, findConflicts, sessionKey } from "../lib/schedule.ts";
import type { AcademicDayRow, CourseRow, TimetableRuleRow, TimetableDraftRow } from "../lib/types.ts";

const course: CourseRow = {
  id: "c1", semester_id: "s1", code: "CS301", name: "Databases", category: "theory",
  attendance_target: null, calculation_mode: "class_count", color: "#8B7CFF", created_at: "2026-01-01T00:00:00Z",
};
const rule = (overrides: Partial<TimetableRuleRow> = {}): TimetableRuleRow => ({
  id: "r1", semester_id: "s1", course_id: "c1", weekday: 1, starts_at: "09:00", ends_at: "10:00",
  location: "Lab 2", valid_from: null, valid_until: null, created_at: "2026-01-01T00:00:00Z", ...overrides,
});
const semester = { id: "s1", start_date: "2026-01-05", end_date: "2026-01-18" };
const day = (date: string, kind: AcademicDayRow["kind"]): AcademicDayRow => ({ id: date, semester_id: "s1", day: date, kind, title: null, notes: null });

test("generates one session per matching weekday in the semester range", () => {
  const sessions = generateSessions({ semester, rules: [rule()], courses: [course], academicDays: [] });
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0]?.title, "Databases");
  assert.equal(sessions[0]?.location, "Lab 2");
  assert.ok(sessions[0]?.startsAt < (sessions[1]?.startsAt ?? ""));
});

test("is idempotent when existing keys are supplied", () => {
  const first = generateSessions({ semester, rules: [rule()], courses: [course], academicDays: [] });
  const existing = new Set(first.map((session) => sessionKey(session.courseId, session.startsAt)));
  const second = generateSessions({ semester, rules: [rule()], courses: [course], academicDays: [], existingKeys: existing });
  assert.equal(second.length, 0);
});

test("holidays, closures, exams and non-instructional days suppress classes", () => {
  const days = [
    day("2026-01-05", "holiday"), day("2026-01-12", "exam"),
    day("2026-01-06", "special_working"), day("2026-01-07", "instructional"),
  ];
  const sessions = generateSessions({ semester, rules: [rule()], courses: [course], academicDays: days });
  assert.equal(sessions.length, 0);
});

test("special working and instructional days keep classes", () => {
  const sessions = generateSessions({
    semester, rules: [rule()], courses: [course],
    academicDays: [day("2026-01-05", "special_working")],
  });
  assert.equal(sessions.length, 2);
});

test("validity windows bound rule expansion", () => {
  const sessions = generateSessions({
    semester, rules: [rule({ valid_from: "2026-01-12", valid_until: "2026-01-12" })],
    courses: [course], academicDays: [],
  });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.dateKey, "2026-01-12");
});

test("rolling semester without end date uses a four month estimate", () => {
  const sessions = generateSessions({ semester: { id: "s1", start_date: "2026-01-05", end_date: null }, rules: [rule()], courses: [course], academicDays: [] });
  assert.ok(sessions.length > 10);
  assert.ok(sessions.length < 25);
});

test("diff detects added, removed and changed entries", () => {
  const before: TimetableDraftRow[] = [
    { id: "a", courseCode: "CS301", courseName: "Databases", weekday: 1, startTime: "09:00", endTime: "10:00", location: "Lab 2" },
    { id: "b", courseCode: "MA302", courseName: "Maths", weekday: 2, startTime: "11:00", endTime: "12:00", location: "R1" },
  ];
  const after: TimetableDraftRow[] = [
    { id: "a2", courseCode: "CS301", courseName: "Databases", weekday: 1, startTime: "09:00", endTime: "10:30", location: "Lab 2" },
    { id: "c", courseCode: "PH303", courseName: "Physics", weekday: 3, startTime: "14:00", endTime: "15:00", location: "R2" },
  ];
  const diff = diffTimetables(before, after);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.changed[0]?.after.endTime, "10:30");
});

test("conflict detection finds overlapping sessions on the same date", () => {
  const sessions = generateSessions({
    semester,
    rules: [rule(), rule({ id: "r2", starts_at: "09:30", ends_at: "10:30" })],
    courses: [course], academicDays: [],
  });
  const conflicts = findConflicts(sessions);
  assert.equal(conflicts.length, 2);
});
