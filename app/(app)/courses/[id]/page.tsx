"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarDays, ClipboardList, Info, NotebookPen, Plus, Trash2 } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useNow } from "@/hooks/use-now";
import { useToast } from "@/components/toast";
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, ProgressBar, RiskBadge, StatCard } from "@/components/ui";
import { TrendChart, ProgressRing } from "@/components/charts";
import { AttendanceMarker } from "@/components/attendance-marker";
import { formatDate, formatTime, relativeDayLabel, WEEKDAYS } from "@/lib/dates";
import { NOTES_STORAGE_KEY, readJsonArray, writeJsonArray } from "@/lib/offline";
import type { LocalNote } from "@/lib/types";
import { summarize } from "@/lib/attendance/engine";

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const {
    semester, courses, stats, sessions, assignments, rules, events, loading, error, refresh,
  } = useWorkspace();
  const toast = useToast();
  const [notes, setNotes] = useState<LocalNote[]>(() => readJsonArray<LocalNote>(NOTES_STORAGE_KEY));
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);

  const course = courses.find((item) => item.id === courseId);
  const now = useNow();
  const stat = stats.find((item) => item.courseId === courseId);
  const courseSessions = useMemo(() => sessions.filter((session) => session.event.course_id === courseId), [sessions, courseId]);
  const courseAssignments = assignments.filter((item) => item.course_id === courseId);
  const courseRules = rules.filter((rule) => rule.course_id === courseId);
  const courseEvents = events.filter((event) => event.course_id === courseId && event.kind !== "class");
  const courseNotes = notes.filter((note) => note.courseId === courseId);

  const trend = useMemo(() => {
    const ordered = courseSessions
      .filter((session) => session.record && session.record.status !== "unmarked")
      .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
    return ordered
      .reduce<{ points: { label: string; value: number | null }[]; present: number; counted: number }>((acc, session) => {
        const present = acc.present + (session.record?.status === "present" ? 1 : 0);
        const counted = acc.counted + (session.record?.status === "present" || session.record?.status === "absent" ? 1 : 0);
        return {
          present,
          counted,
          points: [...acc.points, {
            label: new Date(session.event.starts_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
            value: counted === 0 ? null : Math.round((present / counted) * 1000) / 10,
          }],
        };
      }, { points: [], present: 0, counted: 0 })
      .points;
  }, [courseSessions]);

  function saveNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteTitle.trim() && !noteBody.trim()) return;
    const now = new Date().toISOString();
    const note: LocalNote = {
      id: `note-${Date.now()}`,
      courseId,
      semesterId: semester?.id ?? null,
      title: noteTitle.trim() || "Untitled note",
      body: noteBody.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const next = [note, ...notes];
    setNotes(next);
    writeJsonArray(NOTES_STORAGE_KEY, next);
    setNoteTitle("");
    setNoteBody("");
    setShowNoteForm(false);
    toast.success("Note saved on this device.");
  }

  function removeNote(id: string) {
    const next = notes.filter((note) => note.id !== id);
    setNotes(next);
    writeJsonArray(NOTES_STORAGE_KEY, next);
  }

  if (loading) return <LoadingState rows={5} />;
  if (error) return <ErrorState message={error} retry={() => void refresh()} />;
  if (!course) {
    return (
      <Panel>
        <EmptyState icon={<BookOpen size={20} />} title="Course not found" description="This course is not in your current semester, or it was removed." action={<Link className="btn btn-primary" href="/courses">Back to courses</Link>} />
      </Panel>
    );
  }

  const target = stat?.target ?? semester?.attendance_target ?? 75;
  const engine = summarize({
    sessions: courseSessions.map((session) => ({ status: session.record?.status ?? "unmarked", lifecycle: session.event.status })),
    targetPercent: target,
  });

  return (
    <>
      <PageHeader
        eyebrow="Course detail"
        title={course.name}
        subtitle={`${course.code || "No course code"} · ${course.category} · ${semester?.name ?? "semester"}`}
        actions={<>
          <Link className="btn" href="/courses"><ArrowLeft size={14} /> All courses</Link>
          <Link className="btn" href="/calendar"><CalendarDays size={14} /> Open calendar</Link>
        </>}
      />

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <StatCard label="Attendance" value={stat?.percent === null || !stat ? "—" : `${stat.percent}%`} foot={`Target ${target}%`} icon={<ProgressRing value={stat?.percent ?? null} size={34} />} progress={stat?.percent ?? 0} tone={stat?.risk === "at_risk" ? "danger" : "success"} />
        <StatCard label="Conducted" value={stat?.conducted ?? 0} foot={`${stat?.present ?? 0} attended · ${stat?.absent ?? 0} missed`} />
        <StatCard label="Unmarked" value={stat?.unmarked ?? 0} foot="Never counted as absent" />
        <StatCard label="Safe to miss" value={stat?.bunkAllowance ?? "—"} foot={stat?.bunkAllowance === null ? "Not enough data" : `Before falling below ${target}%`} />
      </div>

      <div className="dash-grid">
        <Panel eyebrow="Calculation" title="How this number is worked out" action={<RiskBadge risk={stat?.risk ?? "unknown"} />}>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <ProgressRing value={stat?.percent ?? null} size={120} />
            <div style={{ flex: 1, minWidth: 210 }}>
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.75 }}>
                Attendance = attended ÷ conducted × 100. Here that is <strong style={{ color: "var(--text)" }}>{engine.attendedUnits} ÷ {engine.countedUnits}</strong>.
                Excused sessions are conducted but excluded from the percentage. {engine.cancelled} cancelled and {engine.rescheduled} rescheduled originals are excluded.
              </p>
              <ProgressBar value={stat?.percent ?? 0} tone={stat?.risk === "at_risk" ? "danger" : "success"} />
              <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                {stat?.recoveryClasses === null ? "Recovery is not currently possible at this target." : stat && stat.recoveryClasses > 0 ? `Attend ${stat.recoveryClasses} consecutive classes to recover to ${target}%.` : "You are at or above target."}
              </div>
            </div>
          </div>
          <hr className="divider" />
          <div className="muted" style={{ fontSize: 11.5 }}>
            <Info size={13} style={{ display: "inline", verticalAlign: "middle" }} /> The live schema has no instructor column, so faculty information is not stored. Course colour, per-course target and calculation mode are supported.
          </div>
        </Panel>

        <Panel eyebrow="Weekly template" title="Class schedule">
          {courseRules.length === 0 ? (
            <EmptyState title="No weekly rules" description="Add a weekly rule in the calendar to generate recurring sessions." action={<Link className="btn btn-sm btn-soft" href="/calendar?tab=timetable">Timetable</Link>} />
          ) : (
            <div className="stack" style={{ gap: 0 }}>
              {courseRules.map((rule) => (
                <div className="list-row" key={rule.id}>
                  <span className="badge badge-accent">{WEEKDAYS[rule.weekday]}</span>
                  <div className="list-row-main"><strong>{rule.starts_at.slice(0, 5)} – {rule.ends_at.slice(0, 5)}</strong><small>{rule.location || "No location"}{rule.valid_from ? ` · from ${rule.valid_from}` : ""}{rule.valid_until ? ` · until ${rule.valid_until}` : ""}</small></div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="dash-grid" style={{ marginTop: 14 }}>
        <Panel eyebrow="History" title="Attendance trend" action={<Link className="btn btn-sm btn-ghost" href="/analytics">Full analytics</Link>}>
          <TrendChart points={trend} target={target} label={`${course.name} attendance trend`} />
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="data">
              <thead><tr><th>Date</th><th>Session</th><th>Status</th><th>Mark</th></tr></thead>
              <tbody>
                {courseSessions.slice(-12).reverse().map((session) => (
                  <tr key={session.event.id}>
                    <td>{formatDate(session.event.starts_at)}</td>
                    <td>{session.event.title}<div className="faint" style={{ fontSize: 10 }}>{formatTime(session.event.starts_at)} · {session.event.status}</div></td>
                    <td><span className={`badge ${session.record?.status === "present" ? "badge-success" : session.record?.status === "absent" ? "badge-danger" : ""}`}>{session.record?.status ?? "unmarked"}</span></td>
                    <td><AttendanceMarker session={session} compact /></td>
                  </tr>
                ))}
                {courseSessions.length === 0 && <tr><td colSpan={4}>No class sessions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="stack">
          <Panel eyebrow="Upcoming" title="Next sessions">
            {courseSessions.filter((s) => new Date(s.event.starts_at).getTime() > now).slice(0, 5).length === 0 ? (
              <EmptyState title="No upcoming sessions" description="Generate sessions from your timetable rules." />
            ) : courseSessions.filter((s) => new Date(s.event.starts_at).getTime() > now).slice(0, 5).map((session) => (
              <div className="list-row" key={session.event.id}>
                <span className="color-bar" style={{ background: course.color }} />
                <div className="list-row-main"><strong>{session.event.title}</strong><small>{relativeDayLabel(session.event.starts_at)} · {formatTime(session.event.starts_at)}</small></div>
                <span className="badge">{session.event.status}</span>
              </div>
            ))}
          </Panel>

          <Panel eyebrow="Course work" title="Assignments & events">
            {courseAssignments.length === 0 && courseEvents.length === 0 ? (
              <EmptyState icon={<ClipboardList size={20} />} title="Nothing here yet" description="Assignments and non-class events for this course appear here." action={<Link className="btn btn-sm btn-soft" href="/productivity">Add assignment</Link>} />
            ) : (
              <div className="stack" style={{ gap: 0 }}>
                {courseAssignments.map((item) => (
                  <div className="list-row" key={item.id}>
                    <span className="badge badge-accent">Due</span>
                    <div className="list-row-main"><strong>{item.title}</strong><small>{item.due_at ? relativeDayLabel(item.due_at) : "No due date"} · {item.status}</small></div>
                  </div>
                ))}
                {courseEvents.map((event) => (
                  <div className="list-row" key={event.id}>
                    <span className="badge badge-info">{event.kind}</span>
                    <div className="list-row-main"><strong>{event.title}</strong><small>{relativeDayLabel(event.starts_at)}</small></div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel eyebrow="Device-local" title="Notes" action={<button className="btn btn-sm btn-soft" onClick={() => setShowNoteForm((value) => !value)}><Plus size={13} /> Add note</button>} style={{ marginTop: 14 }}>
        <div className="alert" style={{ marginBottom: 12, fontSize: 11.5 }}>
          <NotebookPen size={15} />
          <span>Notes are stored only in this browser because the live database has no notes table. They do not sync to the Android app and are cleared if you clear local data.</span>
        </div>
        {showNoteForm && (
          <form className="stack" onSubmit={saveNote} style={{ gap: 10, marginBottom: 14 }}>
            <input className="input" placeholder="Note title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} maxLength={120} />
            <textarea className="textarea" placeholder="Write your note…" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} maxLength={5000} />
            <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary btn-sm" type="submit">Save note</button><button className="btn btn-sm" type="button" onClick={() => setShowNoteForm(false)}>Cancel</button></div>
          </form>
        )}
        {courseNotes.length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>No notes for this course yet.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {courseNotes.map((note) => (
              <div className="card-flat" key={note.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong style={{ fontSize: 12.5 }}>{note.title}</strong>
                  <button className="btn btn-ghost btn-sm" aria-label={`Delete note ${note.title}`} onClick={() => removeNote(note.id)}><Trash2 size={13} /></button>
                </div>
                <p style={{ fontSize: 12, whiteSpace: "pre-wrap", marginTop: 6 }}>{note.body}</p>
                <span className="faint" style={{ fontSize: 10 }}>{new Date(note.updatedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
