import test from "node:test";
import assert from "node:assert/strict";
import {
  summarize, simulate, percentAfterMissingOne, round,
  type AttendanceSummary,
} from "../lib/attendance/engine.ts";
import { calculateAttendance } from "../lib/attendance-engine.js";

const s = (status: string, lifecycle = "scheduled") => ({ status, lifecycle }) as never;

test("unmarked sessions never enter the denominator", () => {
  const r = summarize({ sessions: [s("present"), s("absent"), s("unmarked"), s("excused")], targetPercent: 75 });
  assert.equal(r.percent, 50);
  assert.equal(r.present, 1);
  assert.equal(r.absent, 1);
  assert.equal(r.excused, 1);
  assert.equal(r.unmarked, 1);
  assert.equal(r.conducted, 3);
  assert.equal(r.counted, 2);
});

test("cancelled and rescheduled originals are excluded", () => {
  const r = summarize({
    sessions: [s("present"), s("absent", "cancelled"), s("absent", "rescheduled"), s("present", "completed")],
    targetPercent: 75,
  });
  assert.equal(r.percent, 100);
  assert.equal(r.cancelled, 1);
  assert.equal(r.rescheduled, 1);
  assert.equal(r.counted, 2);
});

test("a replacement rescheduled session counts once", () => {
  const original = [s("unmarked", "rescheduled")];
  const replacement = [s("present", "scheduled")];
  const r = summarize({ sessions: [...original, ...replacement], targetPercent: 75 });
  assert.equal(r.counted, 1);
  assert.equal(r.present, 1);
  assert.equal(r.percent, 100);
});

test("extra classes are ordinary dated sessions", () => {
  const r = summarize({ sessions: [s("present"), s("present"), s("absent")], targetPercent: 75 });
  assert.equal(r.counted, 3);
  assert.equal(r.percent, 66.7);
});

test("bunk allowance matches the mobile engine", () => {
  const r = summarize({ sessions: Array.from({ length: 20 }, (_, i) => s(i < 16 ? "present" : "absent")), targetPercent: 75 });
  assert.equal(r.percent, 80);
  assert.equal(r.bunkAllowance, 1);
});

test("recovery classes match the mobile engine", () => {
  const r = summarize({ sessions: [...Array(7).fill(s("present")), ...Array(3).fill(s("absent"))], targetPercent: 85 });
  assert.equal(r.percent, 70);
  assert.equal(r.recoveryClasses, 10);
  assert.equal(r.bunkAllowance, 0);
});

test("100 percent target is unreachable after a miss", () => {
  const r = summarize({ sessions: [s("present"), s("absent")], targetPercent: 100 });
  assert.equal(r.recoveryClasses, null);
  assert.equal(r.bunkAllowance, 0);
});

test("zero denominator reports unknown, not zero percent", () => {
  const r = summarize({ sessions: [s("unmarked"), s("excused")], targetPercent: 75 });
  assert.equal(r.percent, null);
  assert.equal(r.bunkAllowance, null);
  assert.equal(r.recoveryClasses, null);
  assert.equal(r.risk, "unknown");
});

test("hours mode uses scheduled minutes and attended minutes", () => {
  const r = summarize({
    mode: "hours",
    targetPercent: 75,
    sessions: [
      { status: "present", scheduledMinutes: 90, attendedMinutes: 60 },
      { status: "absent", scheduledMinutes: 90 },
      { status: "excused", scheduledMinutes: 180 },
    ] as never,
  });
  assert.equal(r.attendedUnits, 60);
  assert.equal(r.countedUnits, 180);
  assert.equal(r.percent, 33.3);
  assert.equal(r.excused, 1);
  assert.equal(r.recoveryMinutes, 300);
  assert.equal(r.recoveryClasses, null);
});

test("hours mode rejects attended minutes beyond scheduled minutes", () => {
  assert.throws(() => summarize({ mode: "hours", sessions: [{ status: "present", scheduledMinutes: 30, attendedMinutes: 45 }] as never }), RangeError);
});

test("invalid targets and modes throw", () => {
  assert.throws(() => summarize({ targetPercent: 101, sessions: [] }), RangeError);
  assert.throws(() => summarize({ mode: "bogus" as never, sessions: [] }), RangeError);
  assert.throws(() => summarize({ sessions: [s("nonsense")] }), RangeError);
});

test("futureUnits drives best/worst projections", () => {
  const r = summarize({ sessions: [s("present"), s("absent")], targetPercent: 75, futureUnits: 4 });
  assert.equal(r.percent, 50);
  assert.equal(r.projectedBestPercent, 83.3);
  assert.equal(r.projectedWorstPercent, 16.7);
  assert.equal(r.futureUnits, 4);
});

test("unknown future schedule makes projections null", () => {
  const r = summarize({ sessions: [s("present")], futureUnits: null });
  assert.equal(r.projectedBestPercent, null);
  assert.equal(r.projectedWorstPercent, null);
});

test("risk classification", () => {
  assert.equal(summarize({ sessions: [s("present"), s("absent")], targetPercent: 75 }).risk, "at_risk");
  assert.equal(summarize({ sessions: Array.from({ length: 10 }, () => s("present")), targetPercent: 75 }).risk, "safe");
});

test("what-if: missing one class reduces percentage deterministically", () => {
  const base = summarize({ sessions: [s("present"), s("present"), s("absent")], futureUnits: 5 });
  const result = simulate(base, { missFuture: 1 });
  assert.equal(result.valid, true);
  assert.equal(result.percent, 50);
  assert.equal(result.meetsTarget, false);
});

test("what-if: extra attended classes and cancellations", () => {
  const base = summarize({ sessions: [s("present"), s("absent")], futureUnits: 4 });
  const result = simulate(base, { attendFuture: 2, extraAttended: 2, cancelFuture: 1 });
  assert.equal(result.valid, true);
  assert.equal(result.percent, 83.3);
  assert.equal(result.remainingFutureUnits, 1);
});

test("what-if rejects scenarios exceeding the future schedule", () => {
  const base = summarize({ sessions: [s("present")], futureUnits: 2 });
  const result = simulate(base, { missFuture: 3 });
  assert.equal(result.valid, false);
  assert.match(result.reason ?? "", /exceeds/);
});

test("what-if is invalid when future schedule is unknown", () => {
  const base = summarize({ sessions: [s("present")], futureUnits: null });
  const result = simulate(base, { attendFuture: 1 });
  assert.equal(result.valid, false);
});

test("percentAfterMissingOne matches deterministic formula", () => {
  const base: AttendanceSummary = summarize({ sessions: [s("present"), s("absent")] });
  assert.equal(percentAfterMissingOne(base), 33.3);
  assert.equal(percentAfterMissingOne(summarize({ sessions: [] })), null);
});

test("round uses one decimal with epsilon-safe behaviour", () => {
  assert.equal(round(33.333), 33.3);
  assert.equal(round(66.666), 66.7);
});

test("legacy web adapter and canonical engine agree on the same records", () => {
  const records = [
    { status: "present" }, { status: "absent" }, { status: "excused" }, { status: "unmarked" },
  ];
  const legacy = calculateAttendance({ records, targetPercent: 75 });
  const canonical = summarize({ sessions: records as never, targetPercent: 75 });
  assert.equal(legacy.attendancePercent, canonical.percent);
  assert.equal(legacy.conducted, canonical.conducted);
  assert.equal(legacy.counted, canonical.counted);
  assert.equal(legacy.present, canonical.present);
  assert.equal(legacy.absent, canonical.absent);
  assert.equal(legacy.excused, canonical.excused);
  assert.equal(legacy.unmarked, canonical.unmarked);
  assert.equal(legacy.maxAdditionalAbsences, canonical.bunkAllowance);
});
