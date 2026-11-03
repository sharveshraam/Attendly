/**
 * Backward-compatible adapter for the original web attendance helper.
 *
 * The canonical engine is now `lib/attendance/engine.ts`, which is semantically
 * identical to the deployed mobile app. This file maps the old
 * `calculateAttendance({records, ...})` API onto that single engine so the
 * original six unit tests keep passing and there is only ONE implementation of
 * the mathematics in the website.
 */
import { summarize } from "./attendance/engine.ts";

/** @param {{records: Array<{status: string, scheduledMinutes?: number|null, attendedMinutes?: number|null, lifecycle?: string}>, targetPercent?: number, mode?: "class_count"|"hours"}} input */
export function calculateAttendance(input) {
  const { records, targetPercent = 75, mode = "class_count" } = input ?? {};
  const summary = summarize({
    sessions: (records ?? []).map((record) => ({
      status: record.status,
      lifecycle: record.lifecycle ?? "scheduled",
      scheduledMinutes: record.scheduledMinutes ?? null,
      attendedMinutes: record.attendedMinutes ?? null,
    })),
    targetPercent,
    mode,
  });

  const noData = summary.percent === null;
  return {
    mode,
    targetPercent,
    present: summary.present,
    absent: summary.absent,
    excused: summary.excused,
    unmarked: summary.unmarked,
    conducted: summary.conducted,
    counted: summary.counted,
    attendedUnits: summary.attendedUnits,
    countedUnits: summary.countedUnits,
    attendancePercent: summary.percent,
    maxAdditionalAbsences: noData ? 0 : summary.bunkAllowance,
    classesNeededToReachTarget: noData ? 0 : summary.recoveryClasses,
    maxAdditionalMissedUnits: noData ? 0 : mode === "hours" ? summary.bunkAllowanceMinutes : null,
    unitsNeededToReachTarget: noData ? 0 : mode === "hours" ? summary.recoveryMinutes : null,
  };
}
