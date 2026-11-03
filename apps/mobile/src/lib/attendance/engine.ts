/**
 * Attendly deterministic attendance engine (mobile).
 *
 * Pure, side-effect-free business logic. No React, no Supabase, no I/O.
 * Semantics are compatible with the web engine in lib/attendance-engine.js:
 *  - `unmarked` sessions never enter the denominator (never auto-absences).
 *  - `excused` sessions are conducted but excluded from the percentage.
 *  - Cancelled and rescheduled *sessions* (event lifecycle) are excluded; a
 *    rescheduled class is counted once, at its replacement dated session.
 *  - Extra classes are ordinary dated sessions and count normally.
 *
 * All percentages are rounded to 1 decimal. Bunk/recovery integers use
 * epsilon-safe floor/ceil to avoid floating point drift.
 */

export type MarkStatus = 'present' | 'absent' | 'excused' | 'unmarked';
export type SessionLifecycle = 'scheduled' | 'cancelled' | 'rescheduled' | 'completed';
export type CalcMode = 'class_count' | 'hours';

export interface EngineSession {
  /** The user's private attendance mark. Defaults to 'unmarked'. */
  status?: MarkStatus;
  /** Event-level lifecycle. Cancelled/rescheduled originals are excluded. */
  lifecycle?: SessionLifecycle;
  scheduledMinutes?: number | null;
  attendedMinutes?: number | null;
}

export interface EngineInput {
  sessions: EngineSession[];
  targetPercent?: number;
  mode?: CalcMode;
  /**
   * Number of remaining scheduled class units (classes, or minutes in hours
   * mode). Pass null when future schedule data is incomplete — projections and
   * bunk allowance that depend on the future are then reported as unknown
   * instead of producing misleading numbers.
   */
  futureUnits?: number | null;
}

export interface AttendanceSummary {
  mode: CalcMode;
  targetPercent: number;
  present: number;
  absent: number;
  excused: number;
  unmarked: number;
  cancelled: number;
  rescheduled: number;
  /** present + absent + excused (excludes unmarked/cancelled/rescheduled). */
  conducted: number;
  /** present + absent — the percentage denominator in class_count mode. */
  counted: number;
  attendedUnits: number;
  countedUnits: number;
  percent: number | null;
  /** Further classes that may be missed while staying >= target. */
  bunkAllowance: number | null;
  /** Consecutive future classes to attend to reach target. null = impossible. */
  recoveryClasses: number | null;
  bunkAllowanceMinutes: number | null;
  recoveryMinutes: number | null;
  futureUnits: number | null;
  /** Estimate: attend every remaining scheduled class. */
  projectedBestPercent: number | null;
  /** Estimate: miss every remaining scheduled class. */
  projectedWorstPercent: number | null;
  risk: 'safe' | 'warning' | 'at_risk' | 'unknown';
}

const EPSILON = 1e-9;

export function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function assertTarget(target: number): void {
  if (!Number.isFinite(target) || target < 0 || target > 100) {
    throw new RangeError('targetPercent must be between 0 and 100');
  }
}

function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite non-negative number`);
  }
  return value;
}

/** Core summary. Throws on invalid input rather than silently coercing. */
export function summarize(input: EngineInput): AttendanceSummary {
  const { sessions, targetPercent = 75, mode = 'class_count', futureUnits = null } = input;
  if (!Array.isArray(sessions)) throw new TypeError('sessions must be an array');
  assertTarget(targetPercent);
  if (mode !== 'class_count' && mode !== 'hours') {
    throw new RangeError('mode must be class_count or hours');
  }
  if (futureUnits !== null) nonNegative(futureUnits, 'futureUnits');

  let present = 0;
  let absent = 0;
  let excused = 0;
  let unmarked = 0;
  let cancelled = 0;
  let rescheduled = 0;
  let attendedUnits = 0;
  let countedUnits = 0;

  for (const session of sessions) {
    const lifecycle = session.lifecycle ?? 'scheduled';
    if (lifecycle === 'cancelled') {
      cancelled += 1;
      continue;
    }
    if (lifecycle === 'rescheduled') {
      rescheduled += 1;
      continue;
    }
    const status = session.status ?? 'unmarked';
    if (status === 'unmarked') {
      unmarked += 1;
      continue;
    }
    if (status === 'excused') {
      excused += 1;
      continue;
    }
    if (status !== 'present' && status !== 'absent') {
      throw new RangeError(`Unknown attendance status: ${String(status)}`);
    }

    if (mode === 'class_count') {
      if (status === 'present') {
        present += 1;
        attendedUnits += 1;
      } else {
        absent += 1;
      }
      countedUnits += 1;
      continue;
    }

    // hours mode
    const minutes = nonNegative(session.scheduledMinutes ?? 0, 'scheduledMinutes');
    if (status === 'absent') {
      absent += 1;
      countedUnits += minutes;
    } else {
      present += 1;
      const actual = nonNegative(session.attendedMinutes ?? minutes, 'attendedMinutes');
      if (actual > minutes) throw new RangeError('attendedMinutes cannot exceed scheduledMinutes');
      attendedUnits += actual;
      countedUnits += minutes;
    }
  }

  const conducted = present + absent + excused;
  const counted = present + absent;
  const percent = countedUnits === 0 ? null : round((attendedUnits / countedUnits) * 100);
  const t = targetPercent / 100;

  // Bunk allowance: max x >= 0 with attended / (counted + x) >= target.
  let bunkAllowanceMinutes: number | null = null;
  let recoveryMinutes: number | null = null;
  if (percent !== null) {
    if (targetPercent === 0) {
      bunkAllowanceMinutes = Number.POSITIVE_INFINITY;
      recoveryMinutes = 0;
    } else if (percent >= targetPercent) {
      bunkAllowanceMinutes = Math.max(0, attendedUnits / t - countedUnits);
      recoveryMinutes = 0;
    } else if (targetPercent < 100) {
      bunkAllowanceMinutes = 0;
      recoveryMinutes = Math.max(0, (t * countedUnits - attendedUnits) / (1 - t));
    } else {
      bunkAllowanceMinutes = 0;
      recoveryMinutes = null; // 100% target already missed: unreachable.
    }
  }

  const bunkAllowance =
    mode === 'class_count'
      ? bunkAllowanceMinutes === null
        ? null
        : Number.isFinite(bunkAllowanceMinutes)
          ? Math.max(0, Math.floor(bunkAllowanceMinutes + EPSILON))
          : futureUnits === null
            ? null
            : Math.max(0, Math.floor(futureUnits))
      : null;

  const recoveryClasses =
    mode === 'class_count'
      ? recoveryMinutes === null
        ? percent === null
          ? null
          : null
        : Math.max(0, Math.ceil(recoveryMinutes - EPSILON))
      : null;

  const projectedBestPercent =
    futureUnits === null || countedUnits + futureUnits === 0
      ? null
      : round(((attendedUnits + futureUnits) / (countedUnits + futureUnits)) * 100);
  const projectedWorstPercent =
    futureUnits === null || countedUnits + futureUnits === 0
      ? null
      : round((attendedUnits / (countedUnits + futureUnits)) * 100);

  let risk: AttendanceSummary['risk'] = 'unknown';
  if (percent !== null) {
    if (percent < targetPercent) risk = 'at_risk';
    else if (mode === 'class_count' && bunkAllowance !== null && bunkAllowance <= 1) risk = 'warning';
    else if (mode === 'hours' && bunkAllowanceMinutes !== null && bunkAllowanceMinutes <= 60) risk = 'warning';
    else risk = 'safe';
  }

  return {
    mode,
    targetPercent,
    present,
    absent,
    excused,
    unmarked,
    cancelled,
    rescheduled,
    conducted,
    counted,
    attendedUnits: round(attendedUnits, mode === 'hours' ? 1 : 0),
    countedUnits: round(countedUnits, mode === 'hours' ? 1 : 0),
    percent,
    bunkAllowance,
    recoveryClasses,
    bunkAllowanceMinutes:
      mode === 'hours' && bunkAllowanceMinutes !== null && Number.isFinite(bunkAllowanceMinutes)
        ? round(bunkAllowanceMinutes, 1)
        : null,
    recoveryMinutes: mode === 'hours' && recoveryMinutes !== null ? round(recoveryMinutes, 1) : null,
    futureUnits,
    projectedBestPercent,
    projectedWorstPercent,
    risk,
  };
}

export interface WhatIfScenario {
  /** Attend this many of the remaining scheduled classes. */
  attendFuture?: number;
  /** Miss this many of the remaining scheduled classes. */
  missFuture?: number;
  /** Extra classes attended beyond the schedule (adds to attended + counted). */
  extraAttended?: number;
  /** Cancel this many future classes (removed from projections only). */
  cancelFuture?: number;
}

export interface WhatIfResult {
  percent: number | null;
  attendedUnits: number;
  countedUnits: number;
  remainingFutureUnits: number | null;
  bunkAllowance: number | null;
  recoveryClasses: number | null;
  meetsTarget: boolean | null;
  valid: boolean;
  reason?: string;
}

/**
 * Simulate a future scenario on top of a computed summary. Deterministic and
 * unit-consistent (classes in class_count mode, minutes in hours mode).
 */
export function simulate(base: AttendanceSummary, scenario: WhatIfScenario): WhatIfResult {
  const attend = nonNegative(scenario.attendFuture ?? 0, 'attendFuture');
  const miss = nonNegative(scenario.missFuture ?? 0, 'missFuture');
  const extra = nonNegative(scenario.extraAttended ?? 0, 'extraAttended');
  const cancel = nonNegative(scenario.cancelFuture ?? 0, 'cancelFuture');

  const invalid = (reason: string): WhatIfResult => ({
    percent: null,
    attendedUnits: base.attendedUnits,
    countedUnits: base.countedUnits,
    remainingFutureUnits: base.futureUnits,
    bunkAllowance: null,
    recoveryClasses: null,
    meetsTarget: null,
    valid: false,
    reason,
  });

  if (base.futureUnits === null && (attend > 0 || miss > 0 || cancel > 0)) {
    return invalid('Future schedule data is incomplete; cannot simulate scheduled classes.');
  }
  if (base.futureUnits !== null && attend + miss + cancel > base.futureUnits) {
    return invalid('Scenario exceeds the number of remaining scheduled classes.');
  }

  const attendedUnits = base.attendedUnits + attend + extra;
  const countedUnits = base.countedUnits + attend + miss + extra;
  const remainingFutureUnits =
    base.futureUnits === null ? null : Math.max(0, base.futureUnits - attend - miss - cancel);
  const percent = countedUnits === 0 ? null : round((attendedUnits / countedUnits) * 100);

  const re = summarize({
    sessions: [],
    targetPercent: base.targetPercent,
    mode: base.mode,
    futureUnits: remainingFutureUnits,
  });
  // Recompute allowance/recovery from the simulated totals.
  const t = base.targetPercent / 100;
  let bunk: number | null = null;
  let recovery: number | null = null;
  if (percent !== null) {
    if (base.targetPercent === 0) {
      bunk = remainingFutureUnits === null ? null : Math.floor(remainingFutureUnits);
      recovery = 0;
    } else if (percent >= base.targetPercent) {
      const raw = attendedUnits / t - countedUnits;
      bunk = base.mode === 'class_count' ? Math.max(0, Math.floor(raw + EPSILON)) : round(raw, 1);
      recovery = 0;
    } else if (base.targetPercent < 100) {
      bunk = 0;
      const raw = (t * countedUnits - attendedUnits) / (1 - t);
      recovery = base.mode === 'class_count' ? Math.max(0, Math.ceil(raw - EPSILON)) : round(raw, 1);
    } else {
      bunk = 0;
      recovery = null;
    }
  }
  void re;

  return {
    percent,
    attendedUnits: round(attendedUnits, base.mode === 'hours' ? 1 : 0),
    countedUnits: round(countedUnits, base.mode === 'hours' ? 1 : 0),
    remainingFutureUnits,
    bunkAllowance: bunk,
    recoveryClasses: recovery,
    meetsTarget: percent === null ? null : percent >= base.targetPercent,
    valid: true,
  };
}

/** Percent after missing exactly one more class (null when no data). */
export function percentAfterMissingOne(base: AttendanceSummary): number | null {
  if (base.countedUnits === 0) return null;
  return round((base.attendedUnits / (base.countedUnits + 1)) * 100);
}
