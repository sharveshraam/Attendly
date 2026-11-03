import test from "node:test";
import assert from "node:assert/strict";
import { answerQuestion, QUICK_QUESTIONS, type AssistantData } from "../lib/assistant.ts";
import { summarize } from "../lib/attendance/engine.ts";
import type { CourseRow, SemesterRow } from "../lib/types.ts";
import type { CourseAttendanceStats, SessionWithAttendance } from "../lib/types.ts";

const semester: SemesterRow = {
  id: "s1", owner_id: "u1", group_id: null, name: "Odd 2026", institution: null,
  start_date: "2026-09-01", end_date: "2026-12-20", attendance_target: 75,
  prediction_mode: "fixed", created_at: "2026-09-01T00:00:00Z",
};
const course: CourseRow = {
  id: "c1", semester_id: "s1", code: "CS301", name: "Databases", category: "theory",
  attendance_target: null, calculation_mode: "class_count", color: "#38B8A5", created_at: "2026-09-01T00:00:00Z",
};
const iso = (days: number, hour = 9) => new Date(Date.UTC(2026, 8, days, hour, 0, 0)).toISOString();
const event = (id: string, starts: string) => ({
  id, semester_id: "s1", group_id: null, course_id: "c1", title: "Databases",
  kind: "class" as const, status: "scheduled" as const, starts_at: starts,
  ends_at: new Date(new Date(starts).getTime() + 3600000).toISOString(),
  location: "Lab 2", description: null, source: "manual", verification_status: "confirmed" as const,
  created_by: "u1", updated_by: null, created_at: starts, updated_at: starts,
});

function data(): AssistantData {
  const sessions: SessionWithAttendance[] = [
    { event: event("e1", iso(1)), record: { id: "a1", user_id: "u1", event_id: "e1", status: "present" as const, attended_minutes: null, note: null, marked_at: iso(1) }, effectiveStatus: "present" as const, pendingSync: false },
    { event: event("e2", iso(2)), record: { id: "a2", user_id: "u1", event_id: "e2", status: "absent" as const, attended_minutes: null, note: null, marked_at: iso(2) }, effectiveStatus: "absent" as const, pendingSync: false },
  ];
  const stats: CourseAttendanceStats[] = [{
    courseId: "c1", target: 75, mode: "class_count", present: 1, absent: 1, excused: 0, unmarked: 0,
    cancelled: 0, rescheduled: 0, conducted: 2, counted: 2, percent: 50, bunkAllowance: 0,
    recoveryClasses: 2, projectedBestPercent: null, projectedWorstPercent: null, futureScheduled: 0,
    risk: "at_risk", attendedUnits: 1, countedUnits: 2, futureUnits: null,
  }];
  return {
    semester, courses: [course], sessions, events: sessions.map((s) => s.event), stats,
    assignments: [], now: Date.UTC(2026, 8, 1, 0, 0, 0),
  };
}

test("quick questions are all provided", () => {
  assert.equal(QUICK_QUESTIONS.length, 7);
});

test("overall answer uses the deterministic engine, not an invented number", () => {
  const d = data();
  const overall = summarize({ sessions: d.sessions.map((s) => ({ status: s.record?.status ?? "unmarked", lifecycle: s.event.status })), targetPercent: 75 });
  const answer = answerQuestion("How is my attendance?", d);
  assert.match(answer.text, new RegExp(`${overall.percent}%`));
  assert.match(answer.text, /below your 75% target/);
});

test("at-risk question reports the course from real stats", () => {
  const answer = answerQuestion("Which course is at risk?", data());
  assert.match(answer.text, /Databases/);
  assert.match(answer.text, /50%/);
});

test("recovery answer uses recoveryClasses from the engine", () => {
  const answer = answerQuestion("How many classes to recover?", data());
  assert.match(answer.text, /attend 2 more classes/);
});

test("no data means an honest setup answer", () => {
  const d = { ...data(), semester: null };
  assert.match(answerQuestion("What is my next class?", d).text, /not set up/i);
});

test("no external AI or group attendance references", () => {
  const d = data();
  assert.doesNotMatch(answerQuestion("summarize my schedule", d).text, /classmate|another student/i);
});

test("assignment question reports honest empty state", () => {
  assert.match(answerQuestion("What assignments are due this week?", data()).text, /No assignments/);
});
