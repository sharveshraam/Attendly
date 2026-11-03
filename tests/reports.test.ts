import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeCsv, toCsv, buildAttendanceCsv, buildCalendarIcs, buildSemesterSummaryCsv,
  buildPrintableReport, escapeHtml,
} from "../lib/reports.ts";
import type { CalendarEventRow, SemesterRow, CourseRow } from "../lib/types.ts";

const semester: SemesterRow = {
  id: "s1", owner_id: "u1", group_id: null, name: "Odd 2026", institution: "Test University",
  start_date: "2026-09-01", end_date: "2026-12-20", attendance_target: 75,
  prediction_mode: "fixed", created_at: "2026-09-01T00:00:00Z",
};
const course: CourseRow = {
  id: "c1", semester_id: "s1", code: "CS301", name: "Databases", category: "theory",
  attendance_target: null, calculation_mode: "class_count", color: "#38B8A5", created_at: "2026-09-01T00:00:00Z",
};
const event: CalendarEventRow = {
  id: "e1", semester_id: "s1", group_id: null, course_id: "c1", title: "Databases",
  kind: "class", status: "scheduled", starts_at: "2026-09-01T03:30:00.000Z",
  ends_at: "2026-09-01T04:30:00.000Z", location: "Lab 2", description: null,
  source: "manual", verification_status: "confirmed", created_by: "u1", updated_by: null,
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
};

test("CSV escaping quotes commas and newlines", () => {
  assert.equal(escapeCsv('a,b'), '"a,b"');
  assert.equal(escapeCsv('say "hi"'), '"say ""hi"""');
  assert.equal(toCsv([["a", "b"], ["c", "d"]]), "a,b\r\nc,d");
});

test("attendance CSV contains real marks only", () => {
  const csv = buildAttendanceCsv(semester, [
    { event, record: { id: "r1", user_id: "u1", event_id: "e1", status: "present", attended_minutes: null, note: null, marked_at: "2026-09-01T05:00:00Z" }, courseName: "Databases" },
    { event: { ...event, id: "e2" }, record: null, courseName: "Databases" },
  ]);
  assert.match(csv, /present/);
  assert.match(csv, /unmarked/);
  assert.doesNotMatch(csv, /100%|testimonial/);
});

test("ICS export contains UID, DTSTART and DTEND", () => {
  const ics = buildCalendarIcs([event]);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /UID:e1@attendly/);
  assert.match(ics, /DTSTART:20260901T033000Z/);
  assert.match(ics, /DTEND:20260901T043000Z/);
});

test("semester summary uses supplied values, not fabricated ones", () => {
  const csv = buildSemesterSummaryCsv(semester, [{ course, percent: 66.7, target: 75, conducted: 3, attended: 2, missed: 1, unmarked: 2, allowance: 0 }]);
  assert.match(csv, /66.7/);
  assert.match(csv, /Databases/);
});

test("printable report escapes HTML and states calculation rules", () => {
  const html = buildPrintableReport({
    semester,
    courses: [{ course: { ...course, name: "<img src=x>" }, percent: 50, target: 75, conducted: 2, attended: 1, missed: 1, unmarked: 0 }],
    assignments: [],
    generatedAt: "2026-11-03T00:00:00Z",
  });
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<img src=x>/);
  assert.match(html, /excluded from the percentage denominator/);
});

test("escapeHtml handles all risky characters", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});
