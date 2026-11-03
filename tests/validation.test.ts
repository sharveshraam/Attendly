import test from "node:test";
import assert from "node:assert/strict";
import {
  safeParse, validateUpload, signupSchema, semesterSchema, eventSchema,
  courseSchema, assignmentSchema, notificationPreferencesSchema, MAX_DOCUMENT_BYTES,
} from "../lib/validation.ts";

test("signup rejects mismatched passwords and short passwords", () => {
  assert.equal(safeParse(signupSchema, { email: "a@b.co", password: "secret1", confirmPassword: "secret2" }).ok, false);
  assert.equal(safeParse(signupSchema, { email: "a@b.co", password: "123", confirmPassword: "123" }).ok, false);
  assert.equal(safeParse(signupSchema, { email: "a@b.co", password: "secret1", confirmPassword: "secret1" }).ok, true);
});

test("semester rejects an end date before the start", () => {
  const parsed = safeParse(semesterSchema, {
    name: "Odd 2026", start_date: "2026-09-01", end_date: "2026-08-01",
    attendance_target: 75, prediction_mode: "rolling",
  });
  assert.equal(parsed.ok, false);
});

test("semester accepts rolling mode without an end date", () => {
  const parsed = safeParse(semesterSchema, {
    name: "Odd 2026", start_date: "2026-09-01", end_date: null,
    attendance_target: "75", prediction_mode: "rolling",
  });
  assert.equal(parsed.ok, true);
});

test("event requires end after start", () => {
  const parsed = safeParse(eventSchema, {
    title: "Lecture", kind: "class", starts_at: "2026-09-01T10:00:00.000Z",
    ends_at: "2026-09-01T09:00:00.000Z", status: "scheduled",
  });
  assert.equal(parsed.ok, false);
});

test("course target may be null to inherit semester default", () => {
  const parsed = safeParse(courseSchema, {
    name: "Databases", code: null, category: "theory", attendance_target: null,
    calculation_mode: "class_count", color: "#38B8A5",
  });
  assert.equal(parsed.ok, true);
});

test("assignment status is restricted to backend values", () => {
  assert.equal(safeParse(assignmentSchema, { title: "A1", status: "pending" }).ok, true);
  assert.equal(safeParse(assignmentSchema, { title: "A1", status: "done" }).ok, false);
});

test("notification preferences validate reminder time", () => {
  assert.equal(safeParse(notificationPreferencesSchema, {
    daily_reminder: true, schedule_changes: true, attendance_warnings: true,
    assignment_reminders: true, reminder_time: "07:00", timezone: "Asia/Kolkata",
  }).ok, true);
  assert.equal(safeParse(notificationPreferencesSchema, {
    daily_reminder: true, schedule_changes: true, attendance_warnings: true,
    assignment_reminders: true, reminder_time: "7am", timezone: "Asia/Kolkata",
  }).ok, false);
});

test("upload validation checks extension, size and declared MIME", () => {
  assert.equal(validateUpload({ name: "timetable.csv", size: 100, type: "text/csv" }).ok, true);
  assert.equal(validateUpload({ name: "malware.exe", size: 100, type: "application/octet-stream" }).ok, false);
  assert.equal(validateUpload({ name: "timetable.csv", size: MAX_DOCUMENT_BYTES + 1, type: "text/csv" }).ok, false);
  assert.equal(validateUpload({ name: "timetable.csv", size: 0, type: "text/csv" }).ok, false);
  assert.equal(validateUpload({ name: "timetable.pdf", size: 100, type: "text/html" }).ok, false);
});

test("safeParse returns a readable first error", () => {
  const result = safeParse(signupSchema, { email: "nope", password: "secret1", confirmPassword: "secret1" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /email/i);
});
