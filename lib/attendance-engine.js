/**
 * Deterministic attendance calculations shared by server and browser code.
 * Unmarked classes never enter the denominator. Excused classes are reported
 * separately and excluded from the percentage.
 */

const COUNTED = new Set(["present", "absent", "excused"]);

function finiteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite non-negative number`);
  }
  return value;
}

function round(value, digits = 1) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

/**
 * @param {{records: Array<{status: string, scheduledMinutes?: number|null, attendedMinutes?: number|null}>, targetPercent?: number, mode?: "class_count"|"hours"}} input
 */
export function calculateAttendance(input) {
  const { records, targetPercent = 75, mode = "class_count" } = input ?? {};
  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  if (!Number.isFinite(targetPercent) || targetPercent < 0 || targetPercent > 100) {
    throw new RangeError("targetPercent must be between 0 and 100");
  }
  if (mode !== "class_count" && mode !== "hours") {
    throw new RangeError("mode must be class_count or hours");
  }

  const summary = { present: 0, absent: 0, excused: 0, unmarked: 0 };
  let attended = 0;
  let denominator = 0;

  for (const record of records) {
    if (!record || !Object.hasOwn(summary, record.status)) {
      throw new RangeError(`Unknown attendance status: ${record?.status}`);
    }
    if (record.status === "unmarked") {
      summary.unmarked += 1;
      continue;
    }
    summary[record.status] += 1;
    if (!COUNTED.has(record.status)) continue;

    if (mode === "class_count") {
      if (record.status === "present") attended += 1;
      if (record.status === "present" || record.status === "absent") denominator += 1;
      continue;
    }

    const minutes = finiteNonNegative(record.scheduledMinutes ?? 0, "scheduledMinutes");
    if (record.status === "absent") {
      denominator += minutes;
    } else if (record.status === "present") {
      const actual = finiteNonNegative(record.attendedMinutes ?? minutes, "attendedMinutes");
      if (actual > minutes) throw new RangeError("attendedMinutes cannot exceed scheduledMinutes");
      attended += actual;
      denominator += minutes;
    }
  }

  const attendancePercent = denominator === 0 ? null : round((attended / denominator) * 100);
  let maxAdditionalAbsences = null;
  let classesNeededToReachTarget = null;
  let maxAdditionalMissedUnits = null;
  let unitsNeededToReachTarget = null;
  if (targetPercent === 0) {
    unitsNeededToReachTarget = 0;
  } else if (denominator === 0 || (attendancePercent !== null && attendancePercent >= targetPercent)) {
    maxAdditionalMissedUnits = Math.max(0, attended / (targetPercent / 100) - denominator);
    unitsNeededToReachTarget = 0;
  } else if (targetPercent < 100) {
    const needed = (targetPercent / 100 * denominator - attended) / (1 - targetPercent / 100);
    unitsNeededToReachTarget = Math.max(0, needed);
    maxAdditionalMissedUnits = 0;
  } else {
    maxAdditionalMissedUnits = 0;
  }
  if (mode === "class_count") {
    maxAdditionalAbsences = maxAdditionalMissedUnits === null
      ? null
      : Math.max(0, Math.floor(maxAdditionalMissedUnits + 1e-9));
    classesNeededToReachTarget = unitsNeededToReachTarget === null
      ? null
      : Math.max(0, Math.ceil(unitsNeededToReachTarget - 1e-9));
  }

  return {
    mode,
    targetPercent,
    present: summary.present,
    absent: summary.absent,
    excused: summary.excused,
    unmarked: summary.unmarked,
    conducted: summary.present + summary.absent + summary.excused,
    counted: summary.present + summary.absent,
    attendedUnits: round(attended, mode === "hours" ? 1 : 0),
    countedUnits: round(denominator, mode === "hours" ? 1 : 0),
    attendancePercent,
    maxAdditionalAbsences,
    classesNeededToReachTarget,
    maxAdditionalMissedUnits: mode === "hours" && maxAdditionalMissedUnits !== null ? round(maxAdditionalMissedUnits, 1) : null,
    unitsNeededToReachTarget: mode === "hours" && unitsNeededToReachTarget !== null ? round(unitsNeededToReachTarget, 1) : null,
  };
}

