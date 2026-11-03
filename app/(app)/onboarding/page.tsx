"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, GraduationCap, Sparkles } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import { Field, PageHeader, Panel } from "@/components/ui";
import { TimetableImport } from "@/components/timetable-import";
import {
  createCourse, createEvents, createSemester, logScheduleChange, updateSemester, upsertProfile,
} from "@/lib/data";
import { findConflicts, generateSessions, sessionKey } from "@/lib/schedule";
import { safeParse, courseSchema, profileSchema, semesterSchema } from "@/lib/validation";
import { addMonths, toDateKey } from "@/lib/dates";
import type { CourseRow, SemesterRow } from "@/lib/types";
import { COURSE_COLORS as COLORS } from "@/lib/theme";

const STEPS = ["Welcome", "Academic setup", "Courses", "Timetable", "Review & finish"];


export default function OnboardingPage() {
  const { user, profile, semester, courses, rules, events, academicDays, refresh } = useWorkspace();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [semesterId, setSemesterId] = useState<string | null>(semester?.id ?? null);
  const [courseRows, setCourseRows] = useState<CourseRow[]>(courses);
  const [draft, setDraft] = useState({
    display_name: profile?.display_name ?? "",
    timezone: profile?.timezone ?? "Asia/Kolkata",
    name: semester?.name ?? "",
    institution: semester?.institution ?? "",
    start_date: semester?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: semester?.end_date ?? "",
    attendance_target: String(semester?.attendance_target ?? 75),
    prediction_mode: (semester?.prediction_mode ?? "rolling") as "fixed" | "rolling",
  });
  const [newCourse, setNewCourse] = useState({ name: "", code: "", category: "theory", attendance_target: "", calculation_mode: "class_count" });

  const activeSemester: SemesterRow | null = useMemo(() => {
    if (!semesterId) return null;
    if (semester && semester.id === semesterId) return semester;
    return {
      id: semesterId,
      owner_id: user?.id ?? "",
      group_id: null,
      name: draft.name,
      institution: draft.institution || null,
      start_date: draft.start_date,
      end_date: draft.end_date || null,
      attendance_target: Number(draft.attendance_target) || 75,
      prediction_mode: draft.prediction_mode,
      created_at: new Date().toISOString(),
    };
  }, [semesterId, semester, user?.id, draft]);

  const generated = useMemo(() => {
    if (!activeSemester || rules.length === 0) return { sessions: [], conflicts: [] };
    const existingKeys = new Set(events.filter((e) => e.kind === "class" && e.course_id).map((e) => sessionKey(e.course_id as string, e.starts_at)));
    const sessions = generateSessions({ semester: activeSemester, rules, courses: courseRows, academicDays, existingKeys });
    return { sessions, conflicts: findConflicts(sessions) };
  }, [activeSemester, rules, courseRows, academicDays, events]);

  async function saveAcademic(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const profileParsed = safeParse(profileSchema, { display_name: draft.display_name || user.email?.split("@")[0] || "Student", timezone: draft.timezone });
    if (!profileParsed.ok) return toast.error(profileParsed.error);
    const parsed = safeParse(semesterSchema, {
      name: draft.name,
      institution: draft.institution || null,
      start_date: draft.start_date,
      end_date: draft.end_date || null,
      attendance_target: draft.attendance_target,
      prediction_mode: draft.prediction_mode,
    });
    if (!parsed.ok) return toast.error(parsed.error);
    setBusy(true);
    try {
      await upsertProfile(user.id, profileParsed.data);
      const row = semesterId
        ? await updateSemester(semesterId, parsed.data)
        : await createSemester({ owner_id: user.id, ...parsed.data });
      setSemesterId(row.id);
      toast.success("Academic setup saved.");
      await refresh();
      setStep(2);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save academic setup.");
    } finally {
      setBusy(false);
    }
  }

  async function addCourse(event: React.FormEvent) {
    event.preventDefault();
    if (!semesterId) return toast.error("Save academic setup first.");
    const parsed = safeParse(courseSchema, {
      name: newCourse.name,
      code: newCourse.code || null,
      category: newCourse.category,
      attendance_target: newCourse.attendance_target === "" ? null : newCourse.attendance_target,
      calculation_mode: newCourse.calculation_mode,
      color: COLORS[courseRows.length % COLORS.length],
    });
    if (!parsed.ok) return toast.error(parsed.error);
    setBusy(true);
    try {
      const row = await createCourse({ semester_id: semesterId, ...parsed.data });
      setCourseRows((current) => [...current, row]);
      setNewCourse({ name: "", code: "", category: "theory", attendance_target: "", calculation_mode: "class_count" });
      await refresh();
      toast.success("Course added.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not add the course.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      if (generated.sessions.length > 0 && user && activeSemester) {
        await createEvents(generated.sessions.map((session) => ({
          semester_id: activeSemester.id,
          course_id: session.courseId,
          title: session.title,
          kind: "class" as const,
          status: "scheduled" as const,
          starts_at: session.startsAt,
          ends_at: session.endsAt,
          location: session.location,
          created_by: user.id,
          source: "timetable",
          verification_status: "confirmed" as const,
        })));
        await logScheduleChange({ semester_id: activeSemester.id, actor_id: user.id, action: "onboarding.sessions.generated", after_data: { count: generated.sessions.length } as never });
      }
      await refresh();
      setStep(5);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not finish setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="First-time setup" title="Set up Attendly" subtitle="Optional steps can be skipped and configured later in Settings." actions={<Link className="btn" href="/home">Skip to dashboard</Link>} />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STEPS.map((label, index) => (
          <span className={`badge ${index === step ? "badge-accent" : index < step ? "badge-success" : ""}`} key={label}>
            {index < step ? <CheckCircle2 size={11} /> : null} {index + 1}. {label}
          </span>
        ))}
      </div>

      {step === 0 && (
        <Panel>
          <div className="empty" style={{ padding: "30px 10px" }}>
            <span className="empty-icon"><GraduationCap size={22} /></span>
            <h3>Let&rsquo;s organise your semester</h3>
            <p>Attendly will ask for your semester, courses and timetable. You review every imported row before anything is saved. No attendance is invented.</p>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <div className="alert" style={{ fontSize: 11.5 }}>Step 1: profile, institution, semester dates and attendance target.</div>
            <div className="alert" style={{ fontSize: 11.5 }}>Step 2: courses, with optional per-course targets and hour-based mode.</div>
            <div className="alert" style={{ fontSize: 11.5 }}>Step 3: CSV timetable / academic calendar with human review, or private PDF/image storage.</div>
            <div className="alert" style={{ fontSize: 11.5 }}>Step 4: review conflicts and generate dated class sessions.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}><button className="btn btn-primary" onClick={() => setStep(1)}>Start setup <ArrowRight size={14} /></button></div>
        </Panel>
      )}

      {step === 1 && (
        <Panel eyebrow="Step 1 of 4" title="Academic setup">
          <form className="stack" onSubmit={saveAcademic}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Display name"><input className="input" value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} placeholder="Your name" /></Field>
              <Field label="Timezone"><input className="input" value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Semester name"><input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Odd Semester 2026" /></Field>
              <Field label="Institution" hint="Optional"><input className="input" value={draft.institution} onChange={(e) => setDraft({ ...draft, institution: e.target.value })} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Semester start"><input className="input" type="date" required value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} /></Field>
              <Field label="Semester end" hint="Blank = rolling estimation"><input className="input" type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Default attendance target (%)"><input className="input" type="number" min="0" max="100" step="0.5" value={draft.attendance_target} onChange={(e) => setDraft({ ...draft, attendance_target: e.target.value })} /></Field>
              <Field label="Prediction mode"><select className="select" value={draft.prediction_mode} onChange={(e) => setDraft({ ...draft, prediction_mode: e.target.value as "fixed" | "rolling" })}><option value="rolling">Rolling</option><option value="fixed">Fixed semester</option></select></Field>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <button className="btn" type="button" onClick={() => setStep(0)}><ArrowLeft size={14} /> Back</button>
              <button className="btn btn-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save & continue"} <ArrowRight size={14} /></button>
            </div>
          </form>
        </Panel>
      )}

      {step === 2 && (
        <Panel eyebrow="Step 2 of 4" title="Courses">
          <form className="stack" onSubmit={addCourse} style={{ marginBottom: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10 }}>
              <Field label="Course name"><input className="input" required value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} placeholder="Database Systems" /></Field>
              <Field label="Code"><input className="input" value={newCourse.code} onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })} placeholder="CS301" /></Field>
              <Field label="Type"><select className="select" value={newCourse.category} onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}>{["theory", "lab", "practical", "tutorial", "seminar", "exam"].map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
              <Field label="Target %" hint="Optional"><input className="input" type="number" min="0" max="100" step="0.5" value={newCourse.attendance_target} onChange={(e) => setNewCourse({ ...newCourse, attendance_target: e.target.value })} /></Field>
            </div>
            <button className="btn btn-soft" disabled={busy} type="submit">Add course</button>
          </form>
          {courseRows.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table className="data"><thead><tr><th>Course</th><th>Code</th><th>Type</th><th>Target</th><th>Mode</th></tr></thead><tbody>
                {courseRows.map((course) => <tr key={course.id}><td>{course.name}</td><td>{course.code ?? "—"}</td><td>{course.category}</td><td>{course.attendance_target ?? "semester default"}</td><td>{course.calculation_mode}</td></tr>)}
              </tbody></table>
            </div>
          )}
          <p className="muted" style={{ fontSize: 11.5, marginBottom: 14 }}>{courseRows.length} course(s) added. You can add more later in Courses.</p>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <button className="btn" onClick={() => setStep(1)}><ArrowLeft size={14} /> Back</button>
            <div style={{ display: "flex", gap: 8 }}><button className="btn btn-ghost" onClick={() => setStep(4)}>Skip timetable</button><button className="btn btn-primary" onClick={() => setStep(3)}>Continue <ArrowRight size={14} /></button></div>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel eyebrow="Step 3 of 4" title="Timetable & academic calendar">
          {semesterId && user ? (
            <TimetableImport semesterId={semesterId} userId={user.id} courses={courseRows} rules={rules} onDone={() => void refresh()} />
          ) : <div className="alert alert-warning">Save academic setup first.</div>}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 18 }}>
            <button className="btn" onClick={() => setStep(2)}><ArrowLeft size={14} /> Back</button>
            <div style={{ display: "flex", gap: 8 }}><button className="btn btn-ghost" onClick={() => setStep(4)}>Skip</button><button className="btn btn-primary" onClick={() => { void refresh(); setStep(4); }}>Review <ArrowRight size={14} /></button></div>
          </div>
        </Panel>
      )}

      {step === 4 && (
        <Panel eyebrow="Step 4 of 4" title="Review & finish">
          <div className="stack" style={{ gap: 10 }}>
            <div className="alert alert-success"><CheckCircle2 size={15} /> Semester: <strong>{draft.name || semester?.name || "Configured"}</strong> · {courseRows.length} course(s) · {rules.length} weekly rule(s) · {academicDays.length} classified day(s).</div>
            <div className="alert alert-accent"><Sparkles size={15} /> {generated.sessions.length} dated class session(s) will be generated from your weekly rules. Existing sessions are skipped, so nothing is duplicated.</div>
            {generated.conflicts.length > 0 && <div className="alert alert-warning">{generated.conflicts.length} overlapping session pair(s) detected. You can still finish and resolve them in the calendar.</div>}
            {activeSemester && (
              <p className="muted" style={{ fontSize: 11.5 }}>
                Range: {activeSemester.start_date} → {activeSemester.end_date ?? toDateKey(addMonths(new Date(activeSemester.start_date), 4))} (rolling estimate). Holidays, exams and closures are excluded automatically.
              </p>
            )}
            <div className="alert" style={{ fontSize: 11.5 }}>Nothing from a PDF or image was interpreted: there is no OCR service in this backend. CSV rows were parsed locally and shown for review before being applied.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 18 }}>
            <button className="btn" onClick={() => setStep(3)}><ArrowLeft size={14} /> Back</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void finish()}>{busy ? "Generating…" : "Confirm & enter dashboard"} <ArrowRight size={14} /></button>
          </div>
        </Panel>
      )}

      {step === 5 && (
        <Panel>
          <div className="empty" style={{ padding: "30px 10px" }}>
            <span className="empty-icon"><CheckCircle2 size={22} /></span>
            <h3>Your workspace is ready</h3>
            <p>Your semester, courses and timetable are saved in Supabase. Mark your first class to start seeing real attendance numbers.</p>
            <Link className="btn btn-primary" href="/home">Enter dashboard <ArrowRight size={14} /></Link>
          </div>
        </Panel>
      )}
    </>
  );
}
