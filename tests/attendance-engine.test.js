import test from "node:test";
import assert from "node:assert/strict";
import { calculateAttendance } from "../lib/attendance-engine.js";

test("unmarked and excused classes are not treated as absences", () => {
  const result = calculateAttendance({
    targetPercent: 75,
    records: [
      { status: "present" },
      { status: "absent" },
      { status: "excused" },
      { status: "unmarked" },
    ],
  });
  assert.equal(result.attendancePercent, 50);
  assert.equal(result.present, 1);
  assert.equal(result.absent, 1);
  assert.equal(result.excused, 1);
  assert.equal(result.unmarked, 1);
  assert.equal(result.conducted, 3);
  assert.equal(result.counted, 2);
});

test("calculates maximum further absences at the selected target", () => {
  const result = calculateAttendance({
    targetPercent: 75,
    records: Array.from({ length: 20 }, (_, index) => ({ status: index < 16 ? "present" : "absent" })),
  });
  assert.equal(result.attendancePercent, 80);
  assert.equal(result.maxAdditionalAbsences, 1);
});

test("calculates classes needed to recover using attended future classes", () => {
  const result = calculateAttendance({
    targetPercent: 85,
    records: [...Array(7).fill({ status: "present" }), ...Array(3).fill({ status: "absent" })],
  });
  assert.equal(result.classesNeededToReachTarget, 10);
  assert.equal(result.maxAdditionalAbsences, 0);
});

test("hours mode uses attended minutes and excludes excused classes", () => {
  const result = calculateAttendance({
    mode: "hours",
    targetPercent: 75,
    records: [
      { status: "present", scheduledMinutes: 90, attendedMinutes: 60 },
      { status: "absent", scheduledMinutes: 90 },
      { status: "excused", scheduledMinutes: 180 },
    ],
  });
  assert.equal(result.attendedUnits, 60);
  assert.equal(result.countedUnits, 180);
  assert.equal(result.attendancePercent, 33.3);
  assert.equal(result.excused, 1);
  assert.equal(result.classesNeededToReachTarget, null);
  assert.equal(result.unitsNeededToReachTarget, 300);
  assert.equal(result.maxAdditionalMissedUnits, 0);
});

test("a missed class makes a 100 percent target unrecoverable by finite future attendance", () => {
  const result = calculateAttendance({ targetPercent: 100, records: [{ status: "present" }, { status: "absent" }] });
  assert.equal(result.classesNeededToReachTarget, null);
  assert.equal(result.maxAdditionalAbsences, 0);
});

test("rejects invalid targets and hour values", () => {
  assert.throws(() => calculateAttendance({ targetPercent: 101, records: [] }), RangeError);
  assert.throws(() => calculateAttendance({ mode: "hours", records: [{ status: "present", scheduledMinutes: 30, attendedMinutes: 45 }] }), RangeError);
});

