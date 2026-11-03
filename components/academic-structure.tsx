"use client";

/**
 * Automatic academic-structure workflow (web).
 *
 * 1 upload timetable -> 2 review extracted courses -> 3 confirm timetable ->
 * 4 upload calendar -> 5 review exceptions -> 6 generate the semester schedule
 * -> 7 review the academic structure -> 8 populate dashboard/courses/calendar.
 *
 * Everything is interpreted locally, every ambiguous row is shown with its
 * ORIGINAL text, and NOTHING is written until the user confirms. All writes are
 * owner-scoped RLS calls with deterministic source keys, so re-importing the
 * same document is idempotent.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BookOpen, CalendarDays, CheckCircle2, FileUp,
  Info, Plus, RefreshCw, Trash2, WandSparkles,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import { EmptyState, Field, PageHeader, Panel, ProgressBar, StatCard } from "@/components/ui";
import { WEEKDAYS } from "@/lib/dates";
import {
  findDocumentByHash, logScheduleChange, markDocumentConfirmed, saveScheduleProjection,
  upsertCalendarExceptions, upsertDetectedCourses, upsertDetectedRules,
  upsertGeneratedSessions, uploadDocument,
} from "@/lib/data";
import { buildCourses, refreshSlotIssues } from "@/lib/academic/grid";
import { computeSchedule, semesterProgress, weeklyDistribution } from "@/lib/academic/engine";
import {
  additionalClassException, cancellationException, normalizeCalendarDate,
  replacementDayException, toDayExceptions,
} from "@/lib/academic/calendar";
import { courseSourceKey } from "@/lib/academic/idempotency";
import {
  courseSourceKeyFor, toCalendarExceptionRows, toCourseInserts, toEventInserts, toRuleInserts,
} from "@/lib/academic/bridge";
import {
  extractAcademicDocument, interpretDocument,
  type ExtractedDocument,
} from "@/lib/academic/formats";
import type {
  CalendarEntry, CalendarExtraction, DayException, DetectedCourse, EngineInput,
  ExtractedSlot, ScheduleResult, SessionType, TimetableExtraction, WeeklyRule,
} from "@/lib/academic/types";
import { COURSE_COLORS } from "@/lib/theme";

const STEPS = [
  "Upload timetable", "Detected courses", "Review timetable", "Upload calendar",
  "Review calendar", "Generate schedule", "Review structure", "Dashboard ready",
];
const SESSION_TYPES: SessionType[] = ["lecture", "tutorial", "lab", "practical", "seminar", "unknown"];
const DAY_KINDS = ["holiday", "institutional_holiday", "closure", "exam", "vacation", "special_working", "compensatory_working", "replacement_day", "timetable_change", "college_event", "semester_start", "semester_end", "other"] as const;

type Kind = "timetable" | "academic_calendar";

function randomUuid(): string {
  const generated = globalThis.crypto?.randomUUID?.();
  if (generated) return generated;
  // Deterministic-shape fallback for browsers without randomUUID (still a
  // valid UUID string, never a secret or credential).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function isReliable(slot: ExtractedSlot): boolean {
  return Boolean(slot.courseName.trim()) && slot.weekday !== null && Boolean(slot.startTime && slot.endTime);
}

function newSlot(): ExtractedSlot {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    raw: "manual entry", courseName: "", courseCode: null, weekday: null,
    startTime: null, endTime: null, sessionType: "lecture",
    faculty: null, room: null, confidence: "medium", issues: [], needsReview: true,
  };
}

export function AcademicStructure() {
  const {
    user, semester, courses, rules, academicDays, events, loading, error, refresh,
  } = useWorkspace();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pasted, setPasted] = useState("");

  const [timetableDoc, setTimetableDoc] = useState<ExtractedDocument | null>(null);
  const [timetableFile, setTimetableFile] = useState<File | null>(null);
  const [timetableSheet, setTimetableSheet] = useState(1);
  const [timetableImportId, setTimetableImportId] = useState<string | null>(null);
  const [slots, setSlots] = useState<ExtractedSlot[]>([]);
  const [courseOverrides, setCourseOverrides] = useState<Record<string, { name: string; code: string; faculty: string }>>({});
  const [calendarDoc, setCalendarDoc] = useState<ExtractedDocument | null>(null);
  const [calendarFile, setCalendarFile] = useState<File | null>(null);
  const [calendarSheet, setCalendarSheet] = useState(1);
  const [calendarImportId, setCalendarImportId] = useState<string | null>(null);
  const [calEntries, setCalEntries] = useState<CalendarEntry[]>([]);
  const [manualExceptions, setManualExceptions] = useState<DayException[]>([]);
  const [semesterStart, setSemesterStart] = useState(semester?.start_date ?? "");
  const [semesterEnd, setSemesterEnd] = useState(semester?.end_date ?? "");
  const [saved, setSaved] = useState<{ courses: number; rules: number; exceptions: number; sessions: number } | null>(null);

  const reliableSlots = useMemo(() => slots.filter(isReliable), [slots]);
  const uncertainSlots = useMemo(() => slots.filter((slot) => !isReliable(slot)), [slots]);
  const unconfirmedSlots = useMemo(
    () => slots.map((slot, index) => ({ slot, index })).filter(({ slot }) => isReliable(slot) && (slot.issues.length > 0 || slot.needsReview)),
    [slots],
  );
  const detectedCourses = useMemo<DetectedCourse[]>(
    () => buildCourses(reliableSlots).map((course) => ({ ...course, ...(courseOverrides[course.key] ?? {}) })),
    [reliableSlots, courseOverrides],
  );
  const confirmedCalEntries = useMemo(() => calEntries.filter((entry) => !entry.needsReview && entry.date), [calEntries]);
  const uncertainCalEntries = useMemo(() => calEntries.filter((entry) => entry.needsReview || !entry.date), [calEntries]);

  const effectiveStart = semesterStart || semester?.start_date || "";
  const effectiveEnd = semesterEnd || "";

  const engineInput = useMemo<EngineInput | null>(() => {
    if (!semester || !effectiveStart) return null;
    const end = effectiveEnd || (() => {
      const date = new Date(`${effectiveStart}T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + 4);
      return date.toISOString().slice(0, 10);
    })();
    // Derive rule keys from the CONFIRMED/EDITED courses, so a corrected name
    // or code still matches the course row, its sessions and its exceptions.
    const ruleRows: WeeklyRule[] = detectedCourses.flatMap((course) => {
      const courseKeyValue = courseSourceKey(semester.id, course.code, course.name);
      return course.slots.map((slot, index) => ({
        id: `draft-${course.key}-${index}`,
        courseKey: courseKeyValue,
        weekday: slot.weekday ?? 0,
        startTime: slot.startTime ?? "09:00",
        endTime: slot.endTime ?? "10:00",
        sessionType: slot.sessionType === "unknown" ? "lecture" : slot.sessionType,
        validFrom: effectiveStart,
        validUntil: end,
      }));
    });
    const exceptions = [
      ...toDayExceptions(confirmedCalEntries).exceptions,
      ...manualExceptions,
    ];
    return {
      semesterStart: effectiveStart,
      semesterEnd: end,
      courses: detectedCourses.map((course) => ({ key: courseSourceKey(semester.id, course.code, course.name), name: course.name })),
      rules: ruleRows,
      exceptions,
      targetPercent: Number(semester.attendance_target ?? 75),
      reality: { asOf: new Date().toISOString().slice(0, 10), marks: {}, conducted: {} },
    };
  }, [semester, effectiveStart, effectiveEnd, confirmedCalEntries, manualExceptions, detectedCourses]);

  const preview = useMemo<ScheduleResult | null>(
    () => engineInput ? computeSchedule(engineInput) : null,
    [engineInput],
  );

  const existingSummary = useMemo(() => ({
    courses: courses.length,
    rules: rules.length,
    days: academicDays.length,
    events: events.length,
  }), [courses.length, rules.length, academicDays.length, events.length]);

  /* ------------------------------------------------------------- importing */
  async function handleFile(file: File, kind: Kind, sheet = 1) {
    if (!user || !semester) return;
    setBusy(true);
    setMessage("");
    try {
      const extracted = await extractAcademicDocument(file, { sheet });
      if (kind === "timetable") { setTimetableFile(file); setTimetableSheet(sheet); } else { setCalendarFile(file); setCalendarSheet(sheet); }
      const dbKind = kind === "timetable" ? "timetable" : "academic_calendar";
      const already = await findDocumentByHash(user.id, dbKind, extracted.contentHash);
      if (already?.confirmed_at) {
        setMessage(`"${file.name}" was already imported and confirmed on ${new Date(already.confirmed_at).toLocaleDateString()}. Nothing was duplicated; review your existing schedule instead.`);
        if (kind === "timetable") setStep(2); else setStep(4);
        return;
      }
      const row = already ?? await uploadDocument(user.id, semester.id, file, dbKind, {
        contentHash: extracted.contentHash,
        // `document_uploads.import_batch_id` is a uuid column.
        importBatchId: randomUuid(),
        sheetIndex: sheet,
      });
      if (kind === "timetable") {
        setTimetableImportId(row.id);
        setTimetableDoc(extracted);
      } else {
        setCalendarImportId(row.id);
        setCalendarDoc(extracted);
      }
      if (extracted.unavailable) {
        setMessage(`${extracted.unavailable} The file is still stored privately in your documents. Use "Paste as text" below or add rows manually — no data was invented.`);
        if (kind === "timetable") { setSlots([]); setStep(2); }
        else { setCalEntries([]); setStep(4); }
        return;
      }
      const interpretation = interpretDocument(extracted, kind);
      if (kind === "timetable") {
        const result = interpretation as TimetableExtraction;
        setSlots(result.slots);
        setCourseOverrides({});
        setStep(1);
        setMessage(`${result.courses.length} course(s) and ${result.slots.length} weekly session(s) detected from ${extracted.format.toUpperCase()}. ${result.uncertain.length} entr${result.uncertain.length === 1 ? "y needs" : "ies need"} confirmation.`);
      } else {
        const result = interpretation as CalendarExtraction;
        setCalEntries([...result.entries, ...result.uncertain]);
        if (result.semesterStart) setSemesterStart(result.semesterStart);
        if (result.semesterEnd) setSemesterEnd(result.semesterEnd);
        setStep(4);
        setMessage(`${result.entries.length} confirmed calendar event(s) and ${result.uncertain.length} needing review, read from ${extracted.format.toUpperCase()}.`);
      }
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "The document could not be read.";
      setMessage(text);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  }

  async function handlePaste(kind: Kind) {
    if (!pasted.trim()) return toast.error("Paste the timetable or calendar rows first.");
    const file = new File([pasted], kind === "timetable" ? "pasted-timetable.csv" : "pasted-calendar.csv", { type: "text/csv" });
    await handleFile(file, kind);
  }

  /* --------------------------------------------------------------- editing */
  function updateSlot(index: number, patch: Partial<ExtractedSlot>) {
    setSlots((current) => current.map((slot, i) => (i === index
      ? refreshSlotIssues({ ...slot, ...patch })
      : slot)));
  }
  /** Explicit human confirmation of an ambiguous row; the original text stays. */
  function confirmSlot(index: number) {
    setSlots((current) => current.map((slot, i) => (i === index
      ? { ...slot, issues: [], needsReview: false, confidence: "high" as const }
      : slot)));
  }
  function confirmAllSlots() {
    setSlots((current) => current.map((slot) => isReliable(slot)
      ? { ...slot, issues: [], needsReview: false, confidence: "high" as const }
      : slot));
  }
  function confirmAllCalendarEntries() {
    setCalEntries((current) => current.map((entry) => ({ ...entry, needsReview: false, issues: [] })));
  }
  function updateCourse(key: string, patch: Partial<{ name: string; code: string; faculty: string }>) {
    setCourseOverrides((current) => {
      const base = current[key] ?? (() => {
        const course = detectedCourses.find((item) => item.key === key);
        return { name: course?.name ?? "", code: course?.code ?? "", faculty: course?.faculty ?? "" };
      })();
      return { ...current, [key]: { ...base, ...patch } };
    });
  }
  function updateCalEntry(index: number, patch: Partial<CalendarEntry>) {
    setCalEntries((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  /* -------------------------------------------------------------- persisting */
  async function confirmAndSave() {
    if (!user || !semester || !engineInput) return;
    // `preview` is memoised on the CURRENT engine input, so it can never be
    // stale after the user goes back and edits an earlier step.
    const finalResult = preview;
    if (!finalResult) return toast.error("No schedule was generated yet.");
    if (detectedCourses.length === 0) return toast.error("Confirm at least one course before saving.");
    if (unconfirmedSlots.length > 0) return toast.error(`Confirm ${unconfirmedSlots.length} flagged timetable row(s) before saving.`);
    if (uncertainCalEntries.length > 0) return toast.error(`Resolve ${uncertainCalEntries.length} ambiguous calendar entry/entries before saving.`);
    setBusy(true);
    try {
      const courseInserts = toCourseInserts(semester.id, detectedCourses, COURSE_COLORS, timetableDoc?.source ?? "manual");
      const savedCourses = await upsertDetectedCourses(courseInserts);
      const idBySourceKey = new Map<string, string>();
      for (const row of savedCourses) if (row.source_key) idBySourceKey.set(row.source_key, row.id);

      const ruleInserts = toRuleInserts(semester.id, detectedCourses, idBySourceKey, engineInput.semesterStart, engineInput.semesterEnd);
      await upsertDetectedRules(ruleInserts);

      const exceptionRows = toCalendarExceptionRows(semester.id, confirmedCalEntries, manualExceptions);
      await upsertCalendarExceptions(exceptionRows);

      const courseIdByKey = new Map<string, string>();
      const courseNameByKey = new Map<string, string>();
      for (const course of detectedCourses) {
        const key = courseSourceKeyFor(semester.id, course);
        const id = idBySourceKey.get(key);
        if (id) {
          courseIdByKey.set(key, id);
          courseNameByKey.set(key, course.name);
        }
      }
      const eventRows = toEventInserts(finalResult, {
        semesterId: semester.id, userId: user.id,
        importId: timetableImportId ?? calendarImportId ?? null,
        courseIdByKey, courseNameByKey,
      });
      const inserted = await upsertGeneratedSessions(eventRows);

      const projection = {
        generatedAt: new Date().toISOString(),
        courseCount: detectedCourses.length,
        expectedByCourse: finalResult.countsByCourse,
        totals: finalResult.totals,
        engine: "lib/academic/engine.ts",
      };
      await saveScheduleProjection(semester.id, user.id, "academic-structure",
        JSON.parse(JSON.stringify(projection)) as import("@/lib/types").Json);
      await logScheduleChange({
        semester_id: semester.id, actor_id: user.id,
        action: "academic-structure.confirmed",
        after_data: {
          courses: courseInserts.length, rules: ruleInserts.length,
          exceptions: exceptionRows.length, sessions: inserted,
        } as never,
      });
      if (timetableImportId) await markDocumentConfirmed(timetableImportId);
      if (calendarImportId) await markDocumentConfirmed(calendarImportId);
      await refresh();
      setSaved({ courses: courseInserts.length, rules: ruleInserts.length, exceptions: exceptionRows.length, sessions: inserted });
      setStep(7);
      toast.success("Academic structure saved. Courses, calendar and dashboard are populated.");
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Could not save the academic structure.";
      setMessage(text);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  }

  /* ---------------------------------------------------------------- render */
  if (loading) return <EmptyState title="Loading your workspace…" description="Fetching your semester, courses and calendar." />;
  if (error) return <EmptyState title="Workspace unavailable" description={error} action={<button className="btn btn-sm" onClick={() => void refresh()}>Retry</button>} />;
  if (!semester) {
    return (
      <Panel>
        <EmptyState
          icon={<BookOpen size={20} />}
          title="Set up a semester first"
          description="Automatic structure detection needs a semester to attach courses, calendar exceptions and generated sessions to."
          action={<Link className="btn btn-primary btn-sm" href="/onboarding">Set up semester <ArrowRight size={13} /></Link>}
        />
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Automatic academic structure"
        title="Import your timetable & calendar"
        subtitle={`${semester.name} · Attendly detects courses, weekly class counts, holidays and expected semester sessions. You only review and confirm.`}
        actions={<Link className="btn" href="/home"><ArrowRight size={14} /> Dashboard</Link>}
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STEPS.map((label, index) => (
          <span key={label} className={`badge ${index === step ? "badge-accent" : index < step ? "badge-success" : ""}`}>
            {index < step ? <CheckCircle2 size={11} /> : null} {index + 1}. {label}
          </span>
        ))}
      </div>

      {message && <div className="alert alert-accent" role="status" style={{ marginBottom: 12 }}><Info size={15} /> <span>{message}</span></div>}

      {/* STEP 1 -------------------------------------------------------- upload timetable */}
      {step === 0 && (
        <Panel eyebrow="Step 1 of 8" title="Upload your weekly timetable">
          <div className="alert" style={{ fontSize: 11.5 }}>
            <WandSparkles size={15} /> CSV, Excel (.xlsx), text-layer PDF and images/screenshots (local OCR) are read in your browser. Nothing is sent to an extraction service and no course is created until you confirm.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="btn btn-primary" style={{ cursor: "pointer" }}>
              <FileUp size={14} /> Choose timetable
              <input
                type="file" className="sr-only"
                accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file, "timetable");
                  event.target.value = "";
                }}
              />
            </label>
            <Link className="btn btn-sm" href="/onboarding">Manual setup instead</Link>
          </div>
          <div style={{ marginTop: 16 }}>
            <Field label="Or paste timetable rows" hint="One session per line: Monday 9:00-10:00 Mathematics (CS301), or tab/comma separated columns.">
              <textarea className="input" rows={5} value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={"Day,Time,Course,Code,Faculty,Room\nMonday,9:00-10:00,Mathematics,MA301,Dr Rao,LH-1"} />
            </Field>
            <button className="btn btn-sm" disabled={busy} onClick={() => void handlePaste("timetable")}>Read pasted timetable</button>
          </div>
        </Panel>
      )}

      {/* STEP 2 -------------------------------------------------------- detected courses */}
      {step === 1 && (
        <Panel eyebrow="Step 2 of 8" title="Courses Attendly detected" action={<span className="badge badge-info">{timetableDoc?.format.toUpperCase() ?? "manual"}</span>}>
          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <StatCard label="Courses" value={detectedCourses.length} foot="Deduplicated by course code" icon={<BookOpen size={16} />} />
            <StatCard label="Weekly sessions" value={reliableSlots.length} foot="Across all courses" icon={<CalendarDays size={16} />} />
            <StatCard label="Needs review" value={uncertainSlots.length} foot="Original text kept" icon={<AlertTriangle size={16} />} />
          </div>
          {timetableDoc?.warnings.map((warning, index) => <div className="alert alert-warning" key={`${index}-${warning}`} style={{ fontSize: 11.5, marginBottom: 8 }}><AlertTriangle size={14} /> {warning}</div>)}
          {timetableDoc && timetableDoc.sheetNames.length > 1 && timetableFile && (
            <label className="field" style={{ marginBottom: 12 }}><span>Worksheet to interpret</span>
              <select className="select" style={{ maxWidth: 260 }} value={timetableSheet} onChange={(event) => void handleFile(timetableFile, "timetable", Number(event.target.value))}>
                {timetableDoc.sheetNames.map((name, index) => <option key={`${name}-${index}`} value={index + 1}>{index + 1}. {name}</option>)}
              </select>
            </label>
          )}
          {detectedCourses.length === 0 ? (
            <EmptyState title="No reliable rows found" description="Every extracted row was ambiguous. Fix them in the review step or add rows manually." />
          ) : (
            <div className="table-wrap"><table className="data">
              <thead><tr><th>Course</th><th>Code</th><th>Faculty</th><th>Days</th><th>Classes / week</th><th>Session types</th></tr></thead>
              <tbody>{detectedCourses.map((course) => (
                <tr key={course.key}>
                  <td><strong>{course.name}</strong></td>
                  <td className="mono">{course.code || "—"}</td>
                  <td>{course.faculty || "—"}</td>
                  <td>{course.days.map((day) => WEEKDAYS[day]).join(", ") || "—"}</td>
                  <td><span className="badge badge-accent">{course.weeklySessions}</span></td>
                  <td>{course.sessionTypes.map((type) => type === "unknown" ? "lecture" : type).join(", ")}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => setStep(2)}>Review & correct <ArrowRight size={14} /></button>
          </div>
        </Panel>
      )}

      {/* STEP 3 -------------------------------------------------------- review timetable */}
      {step === 2 && (
        <Panel eyebrow="Step 3 of 8" title="Review & confirm the timetable">
          <div className="alert" style={{ fontSize: 11.5 }}><Info size={15} /> Edit anything Attendly got wrong. Course codes are used to merge differently formatted names. Rows marked &quot;needs review&quot; keep their original text and are NOT saved until you complete them.</div>
          <div className="panel-head" style={{ marginTop: 12 }}><div><span className="eyebrow">Detected courses</span><h3 className="section-title">Course details</h3></div></div>
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Course name</th><th>Code</th><th>Faculty</th><th>Days</th><th>Weekly classes</th></tr></thead>
            <tbody>{detectedCourses.map((course) => (
              <tr key={course.key}>
                <td><input className="input" style={{ minWidth: 170, minHeight: 32, padding: "5px 8px" }} value={course.name} onChange={(event) => updateCourse(course.key, { name: event.target.value })} /></td>
                <td><input className="input mono" style={{ width: 110, minHeight: 32, padding: "5px 8px" }} value={course.code ?? ""} onChange={(event) => updateCourse(course.key, { code: event.target.value })} /></td>
                <td><input className="input" style={{ width: 130, minHeight: 32, padding: "5px 8px" }} value={course.faculty ?? ""} onChange={(event) => updateCourse(course.key, { faculty: event.target.value })} /></td>
                <td>{course.days.map((day) => WEEKDAYS[day]).join(", ") || "—"}</td>
                <td><span className="badge badge-accent">{course.weeklySessions}</span></td>
              </tr>
            ))}</tbody>
          </table></div>

          <div className="panel-head" style={{ marginTop: 18 }}><div><span className="eyebrow">All weekly sessions</span><h3 className="section-title">Schedule rows</h3></div><button className="btn btn-sm btn-soft" onClick={() => setSlots((current) => [...current, newSlot()])}><Plus size={13} /> Add row</button></div>
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Original</th><th>Course</th><th>Code</th><th>Day</th><th>Start</th><th>End</th><th>Type</th><th>Room</th><th /></tr></thead>
            <tbody>{slots.map((slot, index) => (
              <tr key={slot.id} style={!isReliable(slot) ? { background: "var(--surface-2)" } : undefined}>
                <td className="faint" style={{ fontSize: 10, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }} title={slot.raw}>{slot.raw}</td>
                <td><input className="input" style={{ minWidth: 130, minHeight: 30, padding: "4px 7px" }} value={slot.courseName} onChange={(event) => updateSlot(index, { courseName: event.target.value })} /></td>
                <td><input className="input mono" style={{ width: 90, minHeight: 30, padding: "4px 7px" }} value={slot.courseCode ?? ""} onChange={(event) => updateSlot(index, { courseCode: event.target.value.toUpperCase() })} /></td>
                <td><select className="select" style={{ minHeight: 30, padding: "4px 6px" }} value={slot.weekday ?? ""} onChange={(event) => updateSlot(index, { weekday: event.target.value === "" ? null : Number(event.target.value) })}>
                  <option value="">—</option>{WEEKDAYS.map((day, value) => <option key={day} value={value}>{day}</option>)}
                </select></td>
                <td><input className="input" style={{ width: 76, minHeight: 30, padding: "4px 7px" }} value={slot.startTime ?? ""} placeholder="09:00" onChange={(event) => updateSlot(index, { startTime: event.target.value })} /></td>
                <td><input className="input" style={{ width: 76, minHeight: 30, padding: "4px 7px" }} value={slot.endTime ?? ""} placeholder="10:00" onChange={(event) => updateSlot(index, { endTime: event.target.value })} /></td>
                <td><select className="select" style={{ minHeight: 30, padding: "4px 6px" }} value={slot.sessionType} onChange={(event) => updateSlot(index, { sessionType: event.target.value as SessionType })}>
                  {SESSION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select></td>
                <td><input className="input" style={{ width: 90, minHeight: 30, padding: "4px 7px" }} value={slot.room ?? ""} onChange={(event) => updateSlot(index, { room: event.target.value })} /></td>
                <td><button className="btn btn-ghost btn-sm" aria-label="Remove row" onClick={() => setSlots((current) => current.filter((_, i) => i !== index))}><Trash2 size={13} /></button></td>
              </tr>
            ))}</tbody>
          </table></div>
          {uncertainSlots.length > 0 && (
            <div className="alert alert-warning" style={{ marginTop: 10, fontSize: 11.5 }}>
              <AlertTriangle size={15} /> {uncertainSlots.length} row(s) still need a course name, day and valid start/end time. They will not be saved or counted until completed.
            </div>
          )}
          {unconfirmedSlots.length > 0 && (
            <>
              <div className="panel-head" style={{ marginTop: 18 }}><div><span className="eyebrow">Ambiguous entries</span><h3 className="section-title">Original text — please confirm or correct</h3></div><button className="btn btn-sm btn-soft" onClick={confirmAllSlots}><CheckCircle2 size={12} /> Confirm all</button></div>
              <div className="table-wrap"><table className="data">
                <thead><tr><th>Original extracted text</th><th>Why it needs review</th><th /></tr></thead>
                <tbody>{unconfirmedSlots.map(({ slot, index }) => (
                  <tr key={slot.id}>
                    <td className="faint" style={{ fontSize: 10.5 }}>{slot.raw}</td>
                    <td style={{ fontSize: 11 }}>{slot.issues.join(" ") || "Low-confidence extraction — confirm the values above."}</td>
                    <td><button className="btn btn-sm btn-soft" onClick={() => confirmSlot(index)}><CheckCircle2 size={12} /> Confirm</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary" disabled={detectedCourses.length === 0} onClick={() => setStep(3)}>Confirm {detectedCourses.length} course(s) <ArrowRight size={14} /></button>
          </div>
        </Panel>
      )}

      {/* STEP 4 -------------------------------------------------------- upload calendar */}
      {step === 3 && (
        <Panel eyebrow="Step 4 of 8" title="Upload your academic calendar">
          <div className="alert" style={{ fontSize: 11.5 }}><Info size={15} /> Holidays, exam/vacation periods, special working Saturdays and replacement timetables are combined with the weekly schedule. If you have no calendar, you can skip and add exceptions manually.</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}>
            <label className="btn btn-primary" style={{ cursor: "pointer" }}>
              <FileUp size={14} /> Choose calendar
              <input type="file" className="sr-only" accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file, "academic_calendar");
                event.target.value = "";
              }} />
            </label>
            <button className="btn btn-sm" onClick={() => { setCalEntries([]); setStep(4); }}>Skip / add manually</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <Field label="Or paste calendar rows" hint="date, kind, title — e.g. 2026-01-26, holiday, Republic Day">
              <textarea className="input" rows={4} value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={"date,kind,title\n2026-01-26,holiday,Republic Day\n2026-02-14,special_working,Saturday follows Monday timetable"} />
            </Field>
            <button className="btn btn-sm" disabled={busy} onClick={() => void handlePaste("academic_calendar")}>Read pasted calendar</button>
          </div>
          <hr className="divider" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Semester start"><input className="input" type="date" value={semesterStart} onChange={(event) => setSemesterStart(event.target.value)} /></Field>
            <Field label="Semester end" hint="Blank = 4-month estimate"><input className="input" type="date" value={semesterEnd} onChange={(event) => setSemesterEnd(event.target.value)} /></Field>
          </div>
        </Panel>
      )}

      {/* STEP 5 -------------------------------------------------------- review calendar */}
      {step === 4 && (
        <Panel eyebrow="Step 5 of 8" title="Review & confirm calendar exceptions" action={<span className="badge badge-info">{calendarDoc?.format.toUpperCase() ?? "manual"}</span>}>
          <div className="alert" style={{ fontSize: 11.5 }}><Info size={15} /> A special working day can follow another weekday&apos;s timetable. Choose &quot;full day&quot; or &quot;partial&quot; for holidays; partial closures need the affected hours. Unclear rows stay unsaved until you resolve them.</div>
          {calendarDoc && calendarDoc.sheetNames.length > 1 && calendarFile && (
            <label className="field" style={{ margin: "10px 0" }}><span>Worksheet to interpret</span>
              <select className="select" style={{ maxWidth: 260 }} value={calendarSheet} onChange={(event) => void handleFile(calendarFile, "academic_calendar", Number(event.target.value))}>
                {calendarDoc.sheetNames.map((name, index) => <option key={`${name}-${index}`} value={index + 1}>{index + 1}. {name}</option>)}
              </select>
            </label>
          )}
          {calendarDoc?.warnings.map((warning, index) => <div className="alert alert-warning" key={`${index}-${warning}`} style={{ fontSize: 11.5, marginBottom: 8 }}><AlertTriangle size={14} /> {warning}</div>)}
          <div className="panel-head" style={{ marginTop: 12 }}><div><span className="eyebrow">Detected events</span><h3 className="section-title">Calendar entries</h3></div><button className="btn btn-sm btn-soft" onClick={() => setCalEntries((current) => [...current, {
            id: `manual-cal-${Date.now()}`, raw: "manual entry", date: effectiveStart, endDate: effectiveStart,
            type: "holiday", title: "", scope: "full_day", followsWeekday: null, note: null,
            confidence: "medium", issues: ["Confirm this manually added event."], needsReview: true,
          }])}><Plus size={13} /> Add event</button></div>
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Original</th><th>Date</th><th>End date</th><th>Type</th><th>Scope</th><th>Follows</th><th>Title</th><th /></tr></thead>
            <tbody>{calEntries.map((entry, index) => (
              <tr key={entry.id} style={entry.needsReview ? { background: "var(--surface-2)" } : undefined}>
                <td className="faint" style={{ fontSize: 10, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }} title={entry.raw}>{entry.raw}</td>
                <td><input className="input" type="date" style={{ minHeight: 30, padding: "4px 6px" }} value={entry.date ?? ""} onChange={(event) => updateCalEntry(index, { date: normalizeCalendarDate(event.target.value) })} /></td>
                <td><input className="input" type="date" style={{ minHeight: 30, padding: "4px 6px" }} value={entry.endDate ?? entry.date ?? ""} onChange={(event) => updateCalEntry(index, { endDate: normalizeCalendarDate(event.target.value) })} /></td>
                <td><select className="select" style={{ minHeight: 30, padding: "4px 6px" }} value={entry.type} onChange={(event) => updateCalEntry(index, { type: event.target.value as CalendarEntry["type"], needsReview: false })}>
                  {DAY_KINDS.map((kind) => <option key={kind} value={kind}>{kind.replace(/_/g, " ")}</option>)}
                </select></td>
                <td><select className="select" style={{ minHeight: 30, padding: "4px 6px" }} value={entry.scope} onChange={(event) => updateCalEntry(index, { scope: event.target.value as CalendarEntry["scope"] })}>
                  <option value="full_day">full day</option><option value="partial">partial</option><option value="unknown">unknown</option>
                </select></td>
                <td><select className="select" style={{ minHeight: 30, padding: "4px 6px" }} value={entry.followsWeekday ?? ""} onChange={(event) => updateCalEntry(index, { followsWeekday: event.target.value === "" ? null : Number(event.target.value) })}>
                  <option value="">—</option>{WEEKDAYS.map((day, value) => <option key={day} value={value}>{day}</option>)}
                </select></td>
                <td><input className="input" style={{ minWidth: 130, minHeight: 30, padding: "4px 7px" }} value={entry.title} onChange={(event) => updateCalEntry(index, { title: event.target.value })} /></td>
                <td><button className="btn btn-ghost btn-sm" aria-label="Remove event" onClick={() => setCalEntries((current) => current.filter((_, i) => i !== index))}><Trash2 size={13} /></button></td>
              </tr>
            ))}</tbody>
          </table></div>
          {uncertainCalEntries.length > 0 && (
            <div className="alert alert-warning" style={{ marginTop: 10, fontSize: 11.5, alignItems: "center" }}>
              <AlertTriangle size={15} /> <span style={{ flex: 1 }}>{uncertainCalEntries.length} entr{uncertainCalEntries.length === 1 ? "y needs" : "ies need"} a date / classification / replacement timetable. Click a field to resolve it, then it is included automatically.</span>
              <button className="btn btn-sm btn-soft" onClick={confirmAllCalendarEntries}><CheckCircle2 size={12} /> Confirm all</button>
            </div>
          )}

          <div className="panel-head" style={{ marginTop: 18 }}><div><span className="eyebrow">Manual schedule changes</span><h3 className="section-title">One-off additions, cancellations & replacement days</h3></div></div>
          <ManualExceptions
            courseKeys={detectedCourses.map((course) => ({ key: courseSourceKey(semester.id, course.code, course.name), name: course.name }))}
            exceptions={manualExceptions}
            onChange={setManualExceptions}
            defaultDate={effectiveStart}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <Field label="Semester start"><input className="input" type="date" value={semesterStart} onChange={(event) => setSemesterStart(event.target.value)} /></Field>
            <Field label="Semester end"><input className="input" type="date" value={semesterEnd} onChange={(event) => setSemesterEnd(event.target.value)} /></Field>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setStep(3)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(5)}>Combine & generate <ArrowRight size={14} /></button>
          </div>
        </Panel>
      )}

      {/* STEP 6 -------------------------------------------------------- generate */}
      {step === 5 && (
        <Panel eyebrow="Step 6 of 8" title="Semester schedule generated">
          <div className="alert alert-accent" style={{ fontSize: 11.5 }}><WandSparkles size={15} /> Attendly expanded the weekly timetable onto real calendar dates, applied holidays, exam/vacation periods, special working days and one-off changes, and counted the expected sessions. A timetable entry is NOT a conducted class.</div>
          {!preview ? <EmptyState title="Nothing to generate" description="Add at least one course and valid semester dates." /> : (
            <>
              <div className="stat-grid" style={{ marginBottom: 14 }}>
                <StatCard label="Expected sessions" value={preview.totals.scheduled} foot="After all calendar exceptions" icon={<CalendarDays size={16} />} />
                <StatCard label="Courses" value={preview.countsByCourse.length} foot="Generated automatically" icon={<BookOpen size={16} />} />
                <StatCard label="Cancelled" value={preview.totals.cancelled} foot="Confirmed exceptions only" icon={<AlertTriangle size={16} />} />
                <StatCard label="Semester progress" value={`${semesterProgress(effectiveStart, preview.sessions.length > 0 ? effectiveEnd || preview.sessions[preview.sessions.length - 1]!.date : effectiveStart, new Date().toISOString().slice(0, 10))}%`} foot="Based on semester dates" icon={<RefreshCw size={16} />} />
              </div>
              {preview.warnings.length > 0 && preview.warnings.map((warning, index) => <div className="alert alert-warning" key={`${index}-${warning}`} style={{ fontSize: 11.5, marginBottom: 8 }}><AlertTriangle size={14} /> {warning}</div>)}
              <div className="table-wrap"><table className="data">
                <thead><tr><th>Course</th><th>Classes / week</th><th>Expected this semester</th><th>Cancelled</th><th>Additional</th></tr></thead>
                <tbody>{preview.countsByCourse.map((counts) => {
                  const course = detectedCourses.find((item) => courseSourceKey(semester.id, item.code, item.name) === counts.courseKey || item.key === counts.courseKey);
                  const additional = preview.sessions.filter((session) => session.courseKey === counts.courseKey && session.origin === "additional").length;
                  return <tr key={counts.courseKey}>
                    <td><strong>{course?.name ?? counts.courseKey.split(":").pop()}</strong></td>
                    <td>{counts.weeklySessions}</td>
                    <td><span className="badge badge-accent">{counts.scheduled}</span></td>
                    <td>{counts.cancelled + counts.rescheduled}</td>
                    <td>{additional}</td>
                  </tr>;
                })}</tbody>
              </table></div>
              <p className="faint" style={{ fontSize: 10.5, marginTop: 10 }}>Expected counts are schedule predictions. Attendance percentage still uses only confirmed present/absent marks.</p>
            </>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button className="btn" onClick={() => setStep(4)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(6)}>Review full structure <ArrowRight size={14} /></button>
          </div>
        </Panel>
      )}

      {/* STEP 7 -------------------------------------------------------- review structure */}
      {step === 6 && (
        <Panel eyebrow="Step 7 of 8" title="Review the complete academic structure">
          <div className="alert" style={{ fontSize: 11.5 }}><Info size={15} /> Confirming writes courses, weekly rules, calendar exceptions and dated class sessions to your workspace with RLS. Re-importing the same document creates no duplicates.</div>
          <div className="alert alert-accent" style={{ fontSize: 11.5 }}>
            <BookOpen size={15} /> Academic period <strong>{effectiveStart}</strong> → <strong>{engineInput?.semesterEnd ?? "—"}</strong>. Generated courses carry name, code, faculty (when available), weekly day/time/type schedule and weekly session count; expected semester sessions are shown above. Live attendance stats (conducted, attended, missed, current %, remaining, classes needed and max missable) are shown on the dashboard and always come from confirmed marks, never from a timetable prediction.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
            <div>
              <span className="eyebrow">Weekly class distribution</span>
              <WeeklyDistributionChart result={preview} />
            </div>
            <div>
              <span className="eyebrow">Existing workspace</span>
              <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                <div className="list-row"><div className="list-row-main"><strong>{existingSummary.courses}</strong><small>existing courses</small></div></div>
                <div className="list-row"><div className="list-row-main"><strong>{existingSummary.rules}</strong><small>weekly rules</small></div></div>
                <div className="list-row"><div className="list-row-main"><strong>{existingSummary.days}</strong><small>calendar exceptions</small></div></div>
                <div className="list-row"><div className="list-row-main"><strong>{existingSummary.events}</strong><small>dated events</small></div></div>
              </div>
            </div>
          </div>
          <div className="panel-head" style={{ marginTop: 16 }}><div><span className="eyebrow">First dated sessions</span><h3 className="section-title">Generated schedule preview</h3></div></div>
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Date</th><th>Course</th><th>Time</th><th>Type</th><th>Origin</th><th>Status</th></tr></thead>
            <tbody>{preview?.sessions.slice(0, 12).map((session) => {
              const course = detectedCourses.find((item) => courseSourceKey(semester.id, item.code, item.name) === session.courseKey);
              return <tr key={session.key}>
                <td className="mono">{session.date}</td><td>{course?.name ?? session.courseKey.split(":").pop()}</td>
                <td className="mono">{session.startTime}–{session.endTime}</td><td>{session.sessionType}</td>
                <td><span className="badge">{session.origin}</span></td>
                <td><span className={`badge ${session.cancelled ? "badge-danger" : session.rescheduled ? "badge-warning" : "badge-success"}`}>{session.cancelled ? "cancelled" : session.rescheduled ? "rescheduled" : "scheduled"}</span></td>
              </tr>;
            })}</tbody>
          </table></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setStep(5)}>Back</button>
            <button className="btn btn-primary" disabled={busy || !preview} onClick={() => void confirmAndSave()}>{busy ? "Saving…" : "Confirm & populate Attendly"} <ArrowRight size={14} /></button>
          </div>
        </Panel>
      )}

      {/* STEP 8 -------------------------------------------------------- done */}
      {step === 7 && (
        <Panel eyebrow="Step 8 of 8" title="Your academic structure is ready">
          <div className="empty" style={{ padding: "24px 10px" }}>
            <span className="empty-icon"><CheckCircle2 size={22} /></span>
            <h3>Courses, calendar and dashboard populated</h3>
            <p>Attendly now knows your courses, their weekly class counts, expected semester sessions and how holidays or special working days change them.</p>
          </div>
          {saved && <div className="stat-grid" style={{ marginBottom: 14 }}>
            <StatCard label="Courses" value={saved.courses} foot="Idempotent upsert" icon={<BookOpen size={16} />} />
            <StatCard label="Weekly rules" value={saved.rules} foot="Generated from timetable" icon={<CalendarDays size={16} />} />
            <StatCard label="Exceptions" value={saved.exceptions} foot="Calendar applied" icon={<AlertTriangle size={16} />} />
            <StatCard label="Sessions" value={saved.sessions} foot="New dated classes" icon={<WandSparkles size={16} />} />
          </div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/home">Open dashboard <ArrowRight size={14} /></Link>
            <Link className="btn" href="/courses">View courses</Link>
            <Link className="btn" href="/calendar">View calendar</Link>
            <button className="btn btn-ghost" onClick={() => { setStep(0); setSlots([]); setCalEntries([]); setManualExceptions([]); setSaved(null); }}>Import another semester</button>
          </div>
        </Panel>
      )}
    </>
  );
}

/* ------------------------------------------------------------- sub-widgets */
function WeeklyDistributionChart({ result }: { result: ScheduleResult | null }) {
  if (!result) return <p className="muted" style={{ fontSize: 11.5 }}>No sessions yet.</p>;
  const distribution = weeklyDistribution(result.sessions);
  const entries = Object.entries(distribution).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 16);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return (
    <div className="stack" style={{ gap: 6, marginTop: 8 }}>
      {entries.map(([week, count]) => (
        <div key={week} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="mono faint" style={{ fontSize: 10, width: 78 }}>{week}</span>
          <div style={{ flex: 1 }}><ProgressBar value={(count / max) * 100} tone="success" /></div>
          <span className="mono" style={{ fontSize: 10, width: 24, textAlign: "right" }}>{count}</span>
        </div>
      ))}
      {entries.length === 0 && <p className="muted" style={{ fontSize: 11.5 }}>No weekly distribution yet.</p>}
    </div>
  );
}

function ManualExceptions({ courseKeys, exceptions, onChange, defaultDate }: {
  courseKeys: { key: string; name: string }[];
  exceptions: DayException[];
  onChange: (next: DayException[]) => void;
  defaultDate: string;
}) {
  const [kind, setKind] = useState<"holiday" | "replacement" | "additional" | "cancel">("holiday");
  const [date, setDate] = useState(defaultDate);
  const [courseKey, setCourseKey] = useState(courseKeys[0]?.key ?? "");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [follows, setFollows] = useState(1);
  const [scope, setScope] = useState<"full_day" | "partial">("full_day");

  function add() {
    if (!date) return;
    const id = `manual-${Date.now()}`;
    let exception: DayException;
    if (kind === "replacement") exception = replacementDayException(id, date, follows);
    else if (kind === "additional") exception = additionalClassException(id, courseKey, date, start, end);
    else if (kind === "cancel") {
      exception = cancellationException(id, date, courseKey || null, scope === "partial" ? start : null, scope === "partial" ? end : null, false);
    } else {
      exception = {
        id, date, priority: 60, type: "holiday", scope, followsWeekday: null,
        courseKeys: [], startTime: scope === "partial" ? start : null, endTime: scope === "partial" ? end : null,
        extraRule: null, rescheduled: false, confirmed: true,
      };
    }
    onChange([...exceptions, exception]);
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="field"><span>Change type</span><select className="select" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="holiday">Holiday / closure</option><option value="replacement">Special working day (follows another day)</option>
          <option value="additional">One-time additional class</option><option value="cancel">Cancelled class</option>
        </select></label>
        <label className="field"><span>Date</span><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        {kind === "replacement" && <label className="field"><span>Follows timetable of</span><select className="select" value={follows} onChange={(event) => setFollows(Number(event.target.value))}>{WEEKDAYS.map((day, value) => <option key={day} value={value}>{day}</option>)}</select></label>}
        {(kind === "additional" || kind === "cancel") && <label className="field"><span>Course</span><select className="select" value={courseKey} onChange={(event) => setCourseKey(event.target.value)}>{courseKeys.map((course) => <option key={course.key} value={course.key}>{course.name}</option>)}</select></label>}
        {(kind === "additional" || (kind === "holiday" && scope === "partial") || (kind === "cancel" && scope === "partial")) && <>
          <label className="field"><span>From</span><input className="input" style={{ width: 90 }} value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label className="field"><span>To</span><input className="input" style={{ width: 90 }} value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        </>}
        {(kind === "holiday" || kind === "cancel") && <label className="field"><span>Scope</span><select className="select" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="full_day">Full day</option><option value="partial">Partial (with hours)</option></select></label>}
        <button className="btn btn-sm" onClick={add}><Plus size={13} /> Add</button>
      </div>
      {exceptions.length > 0 && <div className="table-wrap"><table className="data">
        <thead><tr><th>Date</th><th>Type</th><th>Detail</th><th /></tr></thead>
        <tbody>{exceptions.map((exception) => (
          <tr key={exception.id}>
            <td className="mono">{exception.date}</td><td>{exception.type.replace(/_/g, " ")}</td>
            <td>{exception.scope}{exception.followsWeekday !== null ? ` · follows ${WEEKDAYS[exception.followsWeekday]}` : ""}{exception.startTime ? ` · ${exception.startTime}–${exception.endTime}` : ""}</td>
            <td><button className="btn btn-ghost btn-sm" aria-label="Remove change" onClick={() => onChange(exceptions.filter((item) => item.id !== exception.id))}><Trash2 size={13} /></button></td>
          </tr>
        ))}</tbody>
      </table></div>}
    </div>
  );
}
