/**
 * Attendly centralised academic class-count engine.
 *
 * This is the ONLY place that turns weekly rules + calendar exceptions into
 * dated class sessions and expected counts. Every page (web) and the shared
 * Supabase projection (mobile) consume this same logic.
 *
 * Precedence for a single date, highest first:
 *   1. Explicit one-off additions / rescheduled replacements and special
 *      working-day schedules (calendar takes precedence over the weekly rule).
 *   2. Explicit cancellations / partial closures / holiday / exam / vacation /
 *      institutional closure (full day or time window).
 *   3. The normal weekly timetable for the effective weekday.
 *
 * A replacement day ("Saturday follows Monday's timetable") runs Monday's
 * rules ON the Saturday and suppresses any Saturday rules for that date, so
 * the original Monday sessions are never duplicated.
 *
 * A timetable entry is NOT proof a class was conducted. Only confirmed marks
 * or explicit verified-conducted flags feed the attendance percentage; the
 * canonical `summarize()` engine is reused unchanged for all percentages,
 * bunk allowance and recovery calculations.
 */
import { summarize } from "./attendance.ts";
import { addDaysKey, clampRange, eachDateKey, isValidDateKey, weekdayOf } from "./dates.ts";
import { durationMinutes, timeToMinutes } from "./text.ts";
import type {
  CourseCounts, DayException, EngineInput, ScheduleResult, ScheduledSession,
  SessionCounts, SessionType, WeeklyRule,
} from "./types.ts";

const ACTIVATORS = new Set<DayException["type"]>([
  "special_working", "compensatory_working", "replacement_day", "additional",
]);
const SUPPRESSORS = new Set<DayException["type"]>([
  "holiday", "closure", "exam", "vacation", "non_instructional", "cancelled",
]);
const WHOLE_DAY_TYPES = new Set<DayException["type"]>([
  "holiday", "closure", "exam", "vacation", "non_instructional",
]);

export function sessionKey(courseKey: string, date: string, startTime: string, sessionType: SessionType): string {
  return `${courseKey}|${date}|${startTime}|${sessionType}`;
}

function ruleKey(rule: WeeklyRule, date: string): string {
  return sessionKey(rule.courseKey, date, rule.startTime, rule.sessionType);
}

function specificity(exception: DayException): number {
  return (exception.courseKeys.length > 0 ? 2 : 0) + (exception.startTime && exception.endTime ? 2 : 0);
}

function sortExceptions(exceptions: DayException[]): DayException[] {
  return [...exceptions].sort((a, b) =>
    b.priority - a.priority || specificity(b) - specificity(a) || a.id.localeCompare(b.id));
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a1 = timeToMinutes(aStart);
  const a2 = a1 + durationMinutes(aStart, aEnd);
  const b1 = timeToMinutes(bStart);
  const b2 = b1 + durationMinutes(bStart, bEnd);
  return a1 < b2 && b1 < a2;
}

function ruleActiveOn(rule: WeeklyRule, date: string): boolean {
  if (rule.validFrom && date < rule.validFrom) return false;
  if (rule.validUntil && date > rule.validUntil) return false;
  return true;
}

interface DatePlan {
  effectiveWeekday: number;
  suppressAll: boolean;
  partialSuppressors: DayException[];
  extraRules: WeeklyRule[];
  replacementId: string | null;
  warnings: string[];
}

/**
 * Resolve every exception on one date into a single deterministic plan.
 * Exported so incremental UI can show "why" a date changed.
 */
export function planDate(date: string, exceptions: DayException[]): DatePlan {
  const sorted = sortExceptions(exceptions);
  let effectiveWeekday = weekdayOf(date);
  let replacementId: string | null = null;
  let suppressPriority = Number.NEGATIVE_INFINITY;
  let activatePriority = Number.NEGATIVE_INFINITY;
  let workingOverride = false;
  const partialSuppressors: DayException[] = [];
  const extraRules: WeeklyRule[] = [];
  const warnings: string[] = [];

  for (const exception of sorted) {
    // A generic timetable_change that only supplies an extra one-off rule must
    // not cancel the rest of the day. Only targeted changes suppress sessions.
    const targetedChange = exception.courseKeys.length > 0 || Boolean(exception.startTime && exception.endTime);
    if ((SUPPRESSORS.has(exception.type) || exception.type === "timetable_change") &&
        !(exception.type === "timetable_change" && !targetedChange)) {
      const isWholeDay = WHOLE_DAY_TYPES.has(exception.type) &&
        exception.scope !== "partial" &&
        exception.courseKeys.length === 0 &&
        !(exception.startTime && exception.endTime);
      if (isWholeDay) {
        suppressPriority = Math.max(suppressPriority, exception.priority);
      } else if (exception.scope === "partial" && !(exception.startTime && exception.endTime)) {
        // Never invent a partial closure's hours: ask the user instead.
        warnings.push(`"${exception.id}" is a partial closure without times; it was not applied until you confirm the affected hours.`);
      } else {
        partialSuppressors.push(exception);
      }
    }
    if (ACTIVATORS.has(exception.type)) {
      activatePriority = Math.max(activatePriority, exception.priority);
      if (exception.type === "replacement_day" || exception.type === "special_working" || exception.type === "compensatory_working") {
        workingOverride = true;
      }
      if (exception.extraRule) extraRules.push(exception.extraRule);
      if (
        (exception.type === "replacement_day" || exception.type === "special_working" || exception.type === "compensatory_working") &&
        exception.followsWeekday !== null && replacementId === null
      ) {
        effectiveWeekday = exception.followsWeekday;
        replacementId = exception.id;
      }
    }
    if (exception.type === "timetable_change" && exception.extraRule) {
      extraRules.push(exception.extraRule);
    }
  }

  // A special working / replacement day overrides a generic full-day closure
  // only when it is at least as prioritised: the calendar exception wins and
  // the followed weekday's timetable runs once. Explicit one-off classes are
  // generated separately and therefore never restore the whole weekly template.
  const suppressAll = suppressPriority > Number.NEGATIVE_INFINITY &&
    !(activatePriority >= suppressPriority && workingOverride);
  if (suppressPriority > Number.NEGATIVE_INFINITY && extraRules.length > 0 && !workingOverride) {
    warnings.push(`A closure and an explicitly added class exist on ${date}; only the added class runs. Confirm this is intended.`);
  }
  return { effectiveWeekday, suppressAll, partialSuppressors, extraRules, replacementId, warnings };
}

function suppressedBy(session: ScheduledSession, suppressors: DayException[]): DayException | null {
  for (const exception of suppressors) {
    if (exception.courseKeys.length > 0 && !exception.courseKeys.includes(session.courseKey)) continue;
    if (exception.startTime && exception.endTime) {
      if (overlaps(session.startTime, session.endTime, exception.startTime, exception.endTime)) return exception;
    } else {
      return exception;
    }
  }
  return null;
}

/** Deterministic, comparable fingerprint used for caching / incremental work. */
export function scheduleFingerprint(input: EngineInput): string {
  const rules = [...input.rules].sort((a, b) => a.id.localeCompare(b.id)).map((rule) =>
    [rule.id, rule.courseKey, rule.weekday, rule.startTime, rule.endTime, rule.sessionType, rule.validFrom ?? "", rule.validUntil ?? ""].join("~")).join(";");
  const exceptions = [...input.exceptions].sort((a, b) => a.id.localeCompare(b.id)).map((item) =>
    [item.id, item.date, item.priority, item.type, item.scope, item.followsWeekday ?? "", [...item.courseKeys].sort().join("+"), item.startTime ?? "", item.endTime ?? "", item.confirmed ? 1 : 0, item.extraRule?.id ?? ""].join("~")).join(";");
  return [
    input.semesterStart, input.semesterEnd, input.rangeStart ?? "", input.rangeEnd ?? "",
    input.targetPercent ?? 75, input.reality?.asOf ?? "", rules, exceptions,
  ].join("||");
}

const CACHE_LIMIT = 8;
const cache = new Map<string, ScheduleResult>();

/** Bounded in-memory cache: identical inputs never recompute. */
export function computeScheduleCached(input: EngineInput): ScheduleResult {
  const fingerprint = scheduleFingerprint(input);
  const hit = cache.get(fingerprint);
  if (hit) return hit;
  const result = computeSchedule(input);
  cache.set(fingerprint, result);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return result;
}

export function clearScheduleCache(): void {
  cache.clear();
}

/** Dates whose sessions can change when an exception is added/removed. */
export function affectedDatesForException(exception: DayException): string[] {
  if (!isValidDateKey(exception.date)) return [];
  return [exception.date];
}

/** Dates touched by a weekly rule (honouring its validity window). */
export function affectedDatesForRule(rule: WeeklyRule, semesterStart: string, semesterEnd: string): string[] {
  const [lo, hi] = clampRange(semesterStart, semesterEnd, rule.validFrom ?? semesterStart, rule.validUntil ?? semesterEnd);
  if (hi < lo) return [];
  return eachDateKey(lo, hi).filter((date) => weekdayOf(date) === rule.weekday);
}

/** Diff two generated schedules to find only the dates that need recalculation. */
export function changedDates(previous: ScheduledSession[], next: ScheduledSession[]): string[] {
  const byDate = (sessions: ScheduledSession[]) => {
    const map = new Map<string, string>();
    for (const session of sessions) {
      map.set(session.date, `${map.get(session.date) ?? ""};${session.key}:${session.cancelled ? 1 : 0}:${session.rescheduled ? 1 : 0}`);
    }
    return map;
  };
  const before = byDate(previous);
  const after = byDate(next);
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].filter((date) => (before.get(date) ?? "") !== (after.get(date) ?? "")).sort();
}

function emptyCounts(): SessionCounts {
  return { scheduled: 0, conducted: 0, attended: 0, absent: 0, excused: 0, cancelled: 0, rescheduled: 0, pending: 0, remaining: 0 };
}

/**
 * Generate all dated sessions and compute expected counts for every course.
 * Pure and deterministic: same input => identical output on web and Android.
 */
export function computeSchedule(input: EngineInput): ScheduleResult {
  const { semesterStart, semesterEnd, targetPercent = 75 } = input;
  if (!isValidDateKey(semesterStart) || !isValidDateKey(semesterEnd)) {
    return { sessions: [], countsByCourse: [], totals: emptyCounts(), affectedDates: [], warnings: ["Semester start/end dates are missing or invalid; no schedule was generated."] };
  }
  const [start, end] = clampRange(semesterStart, semesterEnd, input.rangeStart ?? semesterStart, input.rangeEnd ?? semesterEnd);
  const dates = end >= start ? eachDateKey(start, end) : [];
  const exceptionsByDate = new Map<string, DayException[]>();
  for (const exception of input.exceptions) {
    if (!exception.confirmed) continue; // unconfirmed exceptions never change counts
    if (!isValidDateKey(exception.date)) continue;
    const list = exceptionsByDate.get(exception.date) ?? [];
    list.push(exception);
    exceptionsByDate.set(exception.date, list);
  }

  const warnings: string[] = [];
  const sessions: ScheduledSession[] = [];
  const seen = new Set<string>();

  for (const date of dates) {
    const plan = planDate(date, exceptionsByDate.get(date) ?? []);
    warnings.push(...plan.warnings);
    const candidates: { rule: WeeklyRule; origin: ScheduledSession["origin"]; originId: string }[] = [];
    if (!plan.suppressAll) {
      for (const rule of input.rules) {
        if (rule.weekday !== plan.effectiveWeekday || !ruleActiveOn(rule, date)) continue;
        candidates.push({
          rule,
          origin: plan.replacementId ? "replacement" : "weekly",
          originId: plan.replacementId ?? rule.id,
        });
      }
    }
    for (const rule of plan.extraRules) {
      if (!ruleActiveOn(rule, date)) continue;
      candidates.push({ rule, origin: "additional", originId: rule.id });
    }
    for (const { rule, origin, originId } of candidates) {
      const key = ruleKey(rule, date);
      if (seen.has(key)) continue; // idempotent: one scheduled session per slot
      seen.add(key);
      const suppressor = suppressedBy(
        { key, courseKey: rule.courseKey, date, startTime: rule.startTime, endTime: rule.endTime, sessionType: rule.sessionType, weekday: weekdayOf(date), origin, originId, cancelled: false, rescheduled: false, replacesKey: null },
        plan.partialSuppressors,
      );
      sessions.push({
        key,
        courseKey: rule.courseKey,
        date,
        startTime: rule.startTime,
        endTime: rule.endTime,
        sessionType: rule.sessionType,
        weekday: weekdayOf(date),
        origin,
        originId,
        cancelled: suppressor !== null && !suppressor.rescheduled,
        rescheduled: suppressor !== null && suppressor.rescheduled,
        replacesKey: null,
      });
    }
  }
  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.courseKey.localeCompare(b.courseKey));

  const reality = input.reality;
  const asOf = reality?.asOf ?? start;
  const courseKeys = input.courses.length > 0
    ? input.courses.map((course) => course.key)
    : [...new Set(sessions.map((session) => session.courseKey))];

  const countsByCourse: CourseCounts[] = [];
  const totals = emptyCounts();
  for (const courseKey of courseKeys) {
    const courseSessions = sessions.filter((session) => session.courseKey === courseKey);
    const engineSessions = courseSessions.map((session) => {
      const status = reality?.marks[session.key] ?? "unmarked";
      const lifecycle = session.cancelled ? "cancelled" : session.rescheduled ? "rescheduled" : "scheduled";
      return { status, lifecycle } as const;
    });
    const remaining = courseSessions.filter((session) =>
      !session.cancelled && session.date > asOf && (reality?.marks[session.key] ?? "unmarked") === "unmarked").length;
    const weeklySessions = input.rules.filter((rule) => rule.courseKey === courseKey).length;
    const summary = summarize({
      sessions: engineSessions,
      targetPercent,
      mode: "class_count",
      futureUnits: remaining,
    });
    const counts: CourseCounts = {
      courseKey,
      weeklySessions,
      scheduled: courseSessions.filter((session) => !session.cancelled && !session.rescheduled).length,
      conducted: summary.conducted,
      attended: summary.present,
      absent: summary.absent,
      excused: summary.excused,
      cancelled: summary.cancelled,
      rescheduled: summary.rescheduled,
      pending: summary.unmarked,
      remaining,
      percent: summary.percent,
      classesRequired: summary.recoveryClasses,
      maxMissable: summary.bunkAllowance,
    };
    countsByCourse.push(counts);
    totals.scheduled += counts.scheduled;
    totals.conducted += counts.conducted;
    totals.attended += counts.attended;
    totals.absent += counts.absent;
    totals.excused += counts.excused;
    totals.cancelled += counts.cancelled;
    totals.rescheduled += counts.rescheduled;
    totals.pending += counts.pending;
    totals.remaining += counts.remaining;
  }

  const affectedDates = input.previousSessions
    ? changedDates(input.previousSessions, sessions)
    : [...new Set(sessions.map((session) => session.date))].sort();
  return { sessions, countsByCourse, totals, affectedDates, warnings: [...new Set(warnings)] };
}

/** Week-key helpers used by the weekly-distribution dashboard widget. */
export function weeklyDistribution(sessions: ScheduledSession[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const session of sessions) {
    if (session.cancelled) continue;
    const weekStart = addDaysKey(session.date, -((weekdayOf(session.date) + 6) % 7));
    out[weekStart] = (out[weekStart] ?? 0) + 1;
  }
  return out;
}

export function semesterProgress(start: string, end: string, asOf: string): number {
  if (!isValidDateKey(start) || !isValidDateKey(end) || end <= start) return 0;
  const total = eachDateKey(start, end).length;
  const elapsed = eachDateKey(start, asOf).length;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}
