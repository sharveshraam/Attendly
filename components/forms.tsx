"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal, Field } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  createAssignment, createCourse, createEvents, createSemester, createTimetableRules,
  logScheduleChange, updateAssignment, updateCourse, updateEvent, updateSemester,
} from "@/lib/data";
import { safeParse, assignmentSchema, courseSchema, eventSchema, semesterSchema, timetableRuleSchema } from "@/lib/validation";
import { toDateTimeLocal, fromDateTimeLocal, WEEKDAYS } from "@/lib/dates";
import type { AssignmentRow, CalendarEventKind, CalendarEventRow, CourseRow, SemesterRow } from "@/lib/types";

const CATEGORIES = ["theory", "lab", "practical", "tutorial", "seminar", "exam"] as const;
const COLORS = ["#8B7CFF", "#54D6D0", "#F0BD6A", "#FF8492", "#79A9FF", "#4FD1A1", "#C792EA", "#F49AC1"];
const KINDS: CalendarEventKind[] = ["class", "exam", "holiday", "deadline", "other"];

function ErrorLine({ message }: { message: string }) {
  return message ? <div className="alert alert-danger" role="alert" style={{ fontSize: 11.5 }}>{message}</div> : null;
}

/* ------------------------------------------------------------------ semester */
export function SemesterForm({ userId, initial, onSaved, onClose }: {
  userId: string; initial?: SemesterRow; onSaved: (row: SemesterRow) => void; onClose: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    institution: initial?.institution ?? "",
    start_date: initial?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: initial?.end_date ?? "",
    attendance_target: String(initial?.attendance_target ?? 75),
    prediction_mode: (initial?.prediction_mode ?? "rolling") as "fixed" | "rolling",
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = safeParse(semesterSchema, {
      name: form.name,
      institution: form.institution || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      attendance_target: form.attendance_target,
      prediction_mode: form.prediction_mode,
    });
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    try {
      const row = initial
        ? await updateSemester(initial.id, parsed.data)
        : await createSemester({ owner_id: userId, ...parsed.data });
      toast.success(initial ? "Semester updated." : "Semester created.");
      onSaved(row);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the semester.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Edit semester" : "New semester"} onClose={onClose}>
      <form className="stack" onSubmit={submit} style={{ gap: 14 }}>
        <Field label="Semester name"><input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Odd Semester 2026" /></Field>
        <Field label="Institution" hint="Optional"><input className="input" value={form.institution} onChange={(e) => set("institution", e.target.value)} placeholder="Your college or university" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Start date"><input className="input" type="date" required value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="End date" hint="Leave blank for rolling estimation"><input className="input" type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Default attendance target (%)"><input className="input" type="number" min="0" max="100" step="0.5" value={form.attendance_target} onChange={(e) => set("attendance_target", e.target.value)} /></Field>
          <Field label="Prediction mode"><select className="select" value={form.prediction_mode} onChange={(e) => set("prediction_mode", e.target.value)}><option value="rolling">Rolling estimate</option><option value="fixed">Fixed semester</option></select></Field>
        </div>
        <ErrorLine message={error} />
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? <Loader2 size={14} className="spin" /> : null}{initial ? "Save changes" : "Create semester"}</button>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------- course */
export function CourseForm({ semesterId, initial, onSaved, onClose }: {
  semesterId: string; initial?: CourseRow; onSaved: () => void; onClose: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    category: initial?.category ?? "theory",
    attendance_target: initial?.attendance_target === null || initial?.attendance_target === undefined ? "" : String(initial.attendance_target),
    calculation_mode: (initial?.calculation_mode ?? "class_count") as "class_count" | "hours",
    color: initial?.color ?? COLORS[0],
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = safeParse(courseSchema, {
      name: form.name,
      code: form.code || null,
      category: form.category,
      attendance_target: form.attendance_target === "" ? null : form.attendance_target,
      calculation_mode: form.calculation_mode,
      color: form.color,
    });
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    try {
      if (initial) await updateCourse(initial.id, parsed.data);
      else await createCourse({ semester_id: semesterId, ...parsed.data });
      toast.success(initial ? "Course updated." : "Course added.");
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the course.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Edit course" : "Add course"} onClose={onClose}>
      <form className="stack" onSubmit={submit} style={{ gap: 14 }}>
        <Field label="Course name"><input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Database Systems" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Course code" hint="Optional"><input className="input" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="CS301" /></Field>
          <Field label="Type"><select className="select" value={form.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Course target (%)" hint="Blank = semester default"><input className="input" type="number" min="0" max="100" step="0.5" value={form.attendance_target} onChange={(e) => set("attendance_target", e.target.value)} /></Field>
          <Field label="Calculation mode"><select className="select" value={form.calculation_mode} onChange={(e) => set("calculation_mode", e.target.value)}><option value="class_count">Class count</option><option value="hours">Hours / minutes</option></select></Field>
        </div>
        <Field label="Colour">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COLORS.map((color) => (
              <button key={color} type="button" aria-label={`Use colour ${color}`} aria-pressed={form.color === color} onClick={() => set("color", color)} style={{ width: 28, height: 28, borderRadius: 9, background: color, border: form.color === color ? "3px solid var(--text)" : "2px solid transparent" }} />
            ))}
          </div>
        </Field>
        <ErrorLine message={error} />
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? <Loader2 size={14} className="spin" /> : null}{initial ? "Save changes" : "Add course"}</button>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------------- event */
export function EventForm({ semesterId, userId, courses, initial, defaultKind, defaultStart, onSaved, onClose }: {
  semesterId: string; userId: string; courses: CourseRow[];
  initial?: CalendarEventRow; defaultKind?: CalendarEventKind; defaultStart?: string;
  onSaved: () => void; onClose: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = defaultStart ?? new Date().toISOString();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    kind: (initial?.kind ?? defaultKind ?? "class") as CalendarEventKind,
    course_id: initial?.course_id ?? "",
    starts_at: toDateTimeLocal(initial?.starts_at ?? start),
    ends_at: toDateTimeLocal(initial?.ends_at ?? new Date(new Date(start).getTime() + 3600000).toISOString()),
    location: initial?.location ?? "",
    description: initial?.description ?? "",
    status: (initial?.status ?? "scheduled") as CalendarEventRow["status"],
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = safeParse(eventSchema, {
      title: form.title,
      kind: form.kind,
      course_id: form.course_id || null,
      starts_at: fromDateTimeLocal(form.starts_at),
      ends_at: fromDateTimeLocal(form.ends_at),
      location: form.location || null,
      description: form.description || null,
      status: form.status,
    });
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    try {
      if (initial) {
        await updateEvent(initial.id, parsed.data, userId);
        await logScheduleChange({
          event_id: initial.id, semester_id: semesterId, actor_id: userId, action: "event.updated",
          before_data: { title: initial.title, starts_at: initial.starts_at, ends_at: initial.ends_at, status: initial.status } as never,
          after_data: parsed.data as never,
        });
      } else {
        await createEvents([{
          semester_id: semesterId,
          created_by: userId,
          ...parsed.data,
          source: "manual",
          verification_status: "confirmed",
        }]);
        await logScheduleChange({
          semester_id: semesterId, actor_id: userId, action: "event.created", after_data: parsed.data as never,
        });
      }
      toast.success(initial ? "Class updated." : "Class added.");
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the class.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Edit calendar entry" : "Add calendar entry"} onClose={onClose}>
      <form className="stack" onSubmit={submit} style={{ gap: 14 }}>
        <Field label="Title"><input className="input" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Database Systems lecture" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Type"><select className="select" value={form.kind} onChange={(e) => set("kind", e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
          <Field label="Course"><select className="select" value={form.course_id} onChange={(e) => set("course_id", e.target.value)}><option value="">No course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Starts"><input className="input" type="datetime-local" required value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
          <Field label="Ends"><input className="input" type="datetime-local" required value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Location" hint="Optional"><input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Room 14" /></Field>
          <Field label="Status"><select className="select" value={form.status} onChange={(e) => set("status", e.target.value)}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="rescheduled">Rescheduled</option></select></Field>
        </div>
        <Field label="Notes" hint="Optional"><textarea className="textarea" value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="alert" style={{ fontSize: 11 }}>Cancelled and rescheduled originals are excluded from attendance calculations. A replacement class must be added separately so it is counted once.</div>
        <ErrorLine message={error} />
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? <Loader2 size={14} className="spin" /> : null}{initial ? "Save changes" : "Add entry"}</button>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------- assignment */
export function AssignmentForm({ semesterId, userId, courses, initial, onSaved, onClose }: {
  semesterId: string; userId: string; courses: CourseRow[];
  initial?: AssignmentRow; onSaved: () => void; onClose: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    course_id: initial?.course_id ?? "",
    due_at: toDateTimeLocal(initial?.due_at ?? null),
    status: (initial?.status ?? "pending") as AssignmentRow["status"],
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = safeParse(assignmentSchema, {
      title: form.title,
      description: form.description || null,
      course_id: form.course_id || null,
      due_at: fromDateTimeLocal(form.due_at),
      status: form.status,
    });
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    try {
      if (initial) await updateAssignment(initial.id, parsed.data);
      else await createAssignment({ owner_id: userId, semester_id: semesterId, ...parsed.data });
      toast.success(initial ? "Assignment updated." : "Assignment created.");
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the assignment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Edit assignment" : "New assignment"} onClose={onClose}>
      <form className="stack" onSubmit={submit} style={{ gap: 14 }}>
        <Field label="Title"><input className="input" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Assignment 2: normalisation" /></Field>
        <Field label="Course"><select className="select" value={form.course_id} onChange={(e) => set("course_id", e.target.value)}><option value="">No course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Due date"><input className="input" type="datetime-local" value={form.due_at} onChange={(e) => set("due_at", e.target.value)} /></Field>
          <Field label="Status"><select className="select" value={form.status} onChange={(e) => set("status", e.target.value)}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="submitted">Submitted</option></select></Field>
        </div>
        <Field label="Description" hint="Optional"><textarea className="textarea" value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <ErrorLine message={error} />
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? <Loader2 size={14} className="spin" /> : null}{initial ? "Save changes" : "Create assignment"}</button>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------- timetable rule */
export function TimetableRuleForm({ semesterId, courses, onSaved, onClose }: {
  semesterId: string; courses: CourseRow[]; onSaved: () => void; onClose: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    course_id: courses[0]?.id ?? "",
    weekday: "1",
    starts_at: "09:00",
    ends_at: "10:00",
    location: "",
    valid_from: "",
    valid_until: "",
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = safeParse(timetableRuleSchema, {
      course_id: form.course_id,
      weekday: form.weekday,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      location: form.location || null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
    });
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    try {
      await createTimetableRules([{
        semester_id: semesterId,
        course_id: parsed.data.course_id,
        weekday: parsed.data.weekday,
        starts_at: parsed.data.starts_at,
        ends_at: parsed.data.ends_at,
        location: parsed.data.location ?? null,
        valid_from: parsed.data.valid_from ?? null,
        valid_until: parsed.data.valid_until ?? null,
      }]);
      toast.success("Weekly rule added. Generate sessions from the calendar to place it on dates.");
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add weekly timetable rule" onClose={onClose}>
      <form className="stack" onSubmit={submit} style={{ gap: 14 }}>
        <Field label="Course"><select className="select" value={form.course_id} onChange={(e) => set("course_id", e.target.value)}>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Weekday"><select className="select" value={form.weekday} onChange={(e) => set("weekday", e.target.value)}>{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></Field>
          <Field label="Start"><input className="input" type="time" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
          <Field label="End"><input className="input" type="time" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></Field>
        </div>
        <Field label="Location" hint="Optional"><input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Valid from" hint="Optional"><input className="input" type="date" value={form.valid_from} onChange={(e) => set("valid_from", e.target.value)} /></Field>
          <Field label="Valid until" hint="Optional"><input className="input" type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} /></Field>
        </div>
        <div className="alert" style={{ fontSize: 11 }}>Rules are weekly templates, not dated classes. Use &ldquo;Generate sessions&rdquo; in the calendar to create the actual class sessions.</div>
        <ErrorLine message={error} />
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? <Loader2 size={14} className="spin" /> : null}Add rule</button>
      </form>
    </Modal>
  );
}
