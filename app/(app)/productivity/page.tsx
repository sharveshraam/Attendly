"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, GraduationCap, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import { ConfirmDialog, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Panel, Segmented } from "@/components/ui";
import { AssignmentForm, EventForm } from "@/components/forms";
import { deleteAssignment, updateAssignment } from "@/lib/data";
import { countdownLabel, formatDate, formatTime, relativeDayLabel } from "@/lib/dates";
import { NOTES_STORAGE_KEY, PRIORITY_STORAGE_KEY, readJsonArray, writeJsonArray } from "@/lib/offline";
import type { AssignmentRow, LocalNote, LocalPriority } from "@/lib/types";

type Tab = "assignments" | "exams" | "notes" | "events";
type PriorityMap = Record<string, LocalPriority>;

const PRIORITY_LABEL: Record<LocalPriority, string> = { 1: "High", 2: "Medium", 3: "Low" };

export default function ProductivityPage() {
  const { semester, courses, assignments, events, user, loading, error, refresh } = useWorkspace();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("assignments");
  const [assignmentForm, setAssignmentForm] = useState<AssignmentRow | "new" | null>(null);
  const [eventForm, setEventForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentRow | null>(null);
  const [priorities, setPriorities] = useState<PriorityMap>(() => {
    const rows = readJsonArray<{ id: string; priority: LocalPriority }>(PRIORITY_STORAGE_KEY);
    return Object.fromEntries(rows.map((row) => [row.id, row.priority]));
  });
  const [notes, setNotes] = useState<LocalNote[]>(() => readJsonArray<LocalNote>(NOTES_STORAGE_KEY));
  const [noteDraft, setNoteDraft] = useState<{ id?: string; title: string; body: string; courseId: string }>({ title: "", body: "", courseId: "" });
  const [noteFormOpen, setNoteFormOpen] = useState(false);

  const exams = useMemo(
    () => events.filter((event) => event.kind === "exam").sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [events],
  );
  const academicEvents = useMemo(
    () => events.filter((event) => !["class", "exam"].includes(event.kind)).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [events],
  );

  function savePriorities(next: PriorityMap) {
    setPriorities(next);
    writeJsonArray(PRIORITY_STORAGE_KEY, Object.entries(next).map(([id, priority]) => ({ id, priority })));
  }

  async function removeAssignment() {
    if (!deleteTarget) return;
    try {
      await deleteAssignment(deleteTarget.id);
      toast.success("Assignment deleted.");
      const next = { ...priorities };
      delete next[deleteTarget.id];
      savePriorities(next);
      setDeleteTarget(null);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not delete the assignment.");
    }
  }

  async function toggleAssignment(item: AssignmentRow) {
    try {
      await updateAssignment(item.id, { status: item.status === "submitted" ? "pending" : "submitted" });
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update the assignment.");
    }
  }

  function saveNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteDraft.title.trim() && !noteDraft.body.trim()) return;
    const now = new Date().toISOString();
    let next: LocalNote[];
    if (noteDraft.id) {
      next = notes.map((note) => note.id === noteDraft.id ? { ...note, title: noteDraft.title.trim() || note.title, body: noteDraft.body, courseId: noteDraft.courseId || null, updatedAt: now } : note);
    } else {
      next = [{ id: `note-${Date.now()}`, title: noteDraft.title.trim() || "Untitled note", body: noteDraft.body, courseId: noteDraft.courseId || null, semesterId: semester?.id ?? null, createdAt: now, updatedAt: now }, ...notes];
    }
    setNotes(next);
    writeJsonArray(NOTES_STORAGE_KEY, next);
    setNoteFormOpen(false);
    setNoteDraft({ title: "", body: "", courseId: "" });
    toast.success("Note saved on this device.");
  }

  return (
    <>
      <PageHeader
        eyebrow="Academic productivity"
        title="Productivity"
        subtitle={semester ? `${assignments.length} assignments · ${exams.length} exams · ${notes.length} device-local notes` : "Set up a semester first."}
        actions={<>
          <button className="btn" disabled={!semester} onClick={() => setEventForm(true)}><CalendarDays size={14} /> Add exam / event</button>
          <button className="btn btn-primary" disabled={!semester} onClick={() => setAssignmentForm("new")}><Plus size={14} /> New assignment</button>
        </>}
      />

      <div style={{ marginBottom: 14 }}>
        <Segmented<Tab> label="Productivity section" value={tab} onChange={setTab} options={[
          { value: "assignments", label: "Assignments" }, { value: "exams", label: "Exams" },
          { value: "notes", label: "Notes" }, { value: "events", label: "Academic events" },
        ]} />
      </div>

      {loading ? <LoadingState rows={4} /> : error ? <ErrorState message={error} retry={() => void refresh()} /> : !semester ? (
        <Panel><EmptyState title="No semester" description="Create a semester first." action={<Link className="btn btn-primary" href="/onboarding">Start onboarding</Link>} /></Panel>
      ) : (
        <>
          {tab === "assignments" && (
            <Panel eyebrow="Deadlines" title="Assignments" action={<button className="btn btn-sm btn-primary" onClick={() => setAssignmentForm("new")}><Plus size={13} /> Add</button>}>
              {assignments.length === 0 ? (
                <EmptyState icon={<ClipboardList size={20} />} title="No assignments yet" description="Track coursework, deadlines and completion status here." action={<button className="btn btn-primary btn-sm" onClick={() => setAssignmentForm("new")}>New assignment</button>} />
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Done</th><th>Title</th><th>Course</th><th>Due</th><th>Priority</th><th>Status</th><th /></tr></thead>
                    <tbody>
                      {assignments.map((item) => (
                        <tr key={item.id}>
                          <td><input type="checkbox" aria-label={`Mark ${item.title} ${item.status === "submitted" ? "not submitted" : "submitted"}`} checked={item.status === "submitted"} onChange={() => void toggleAssignment(item)} /></td>
                          <td><strong>{item.title}</strong>{item.description && <div className="faint" style={{ fontSize: 10.5, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</div>}</td>
                          <td>{courses.find((c) => c.id === item.course_id)?.name ?? "—"}</td>
                          <td>{item.due_at ? `${relativeDayLabel(item.due_at)} · ${countdownLabel(item.due_at)}` : "—"}</td>
                          <td>
                            <select className="select" style={{ minHeight: 30, padding: "4px 8px", width: 100 }} value={priorities[item.id] ?? 2} onChange={(e) => savePriorities({ ...priorities, [item.id]: Number(e.target.value) as LocalPriority })} aria-label={`Priority for ${item.title}`}>
                              <option value={1}>High</option><option value={2}>Medium</option><option value={3}>Low</option>
                            </select>
                          </td>
                          <td><span className={`badge ${item.status === "submitted" ? "badge-success" : "badge-warning"}`}>{PRIORITY_LABEL[priorities[item.id] ?? 2]} · {item.status.replace("_", " ")}</span></td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-ghost btn-sm" aria-label={`Edit ${item.title}`} onClick={() => setAssignmentForm(item)}><Pencil size={13} /></button>
                              <button className="btn btn-ghost btn-sm" aria-label={`Delete ${item.title}`} onClick={() => setDeleteTarget(item)}><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="faint" style={{ fontSize: 10.5, marginTop: 12 }}>Priority is a device-local overlay: the live <code>assignments</code> table has no priority column. It does not sync to Android.</p>
            </Panel>
          )}

          {tab === "exams" && (
            <Panel eyebrow="Countdowns" title="Examinations" action={<button className="btn btn-sm btn-primary" onClick={() => setEventForm(true)}><Plus size={13} /> Add exam</button>}>
              {exams.length === 0 ? <EmptyState icon={<GraduationCap size={20} />} title="No exams scheduled" description="Exams are calendar events with an exam classification." /> : (
                <div className="stack" style={{ gap: 0 }}>
                  {exams.map((exam) => (
                    <div className="list-row" key={exam.id}>
                      <span className="badge badge-danger">Exam</span>
                      <div className="list-row-main"><strong>{exam.title}</strong><small>{formatDate(exam.starts_at)} · {formatTime(exam.starts_at)} – {formatTime(exam.ends_at)}{exam.location ? ` · ${exam.location}` : ""}</small></div>
                      <span className="badge mono">{countdownLabel(exam.starts_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "notes" && (
            <Panel eyebrow="Device-local" title="Notes" action={<button className="btn btn-sm btn-primary" onClick={() => { setNoteDraft({ title: "", body: "", courseId: "" }); setNoteFormOpen(true); }}><Plus size={13} /> New note</button>}>
              <div className="alert" style={{ marginBottom: 12, fontSize: 11.5 }}><NotebookPen size={15} /> Notes are stored only in this browser because no notes table exists in the live schema. They do not sync across devices.</div>
              {notes.length === 0 ? <EmptyState icon={<NotebookPen size={20} />} title="No notes yet" description="Write a note and optionally link it to a course." /> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10 }}>
                  {notes.map((note) => (
                    <div className="card-flat" key={note.id}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                        <strong style={{ fontSize: 12.5 }}>{note.title}</strong>
                        <div style={{ display: "flex", gap: 3 }}>
                          <button className="btn btn-ghost btn-sm" aria-label={`Edit note ${note.title}`} onClick={() => { setNoteDraft({ id: note.id, title: note.title, body: note.body, courseId: note.courseId ?? "" }); setNoteFormOpen(true); }}><Pencil size={13} /></button>
                          <button className="btn btn-ghost btn-sm" aria-label={`Delete note ${note.title}`} onClick={() => { const next = notes.filter((n) => n.id !== note.id); setNotes(next); writeJsonArray(NOTES_STORAGE_KEY, next); }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <p style={{ fontSize: 11.5, whiteSpace: "pre-wrap", marginTop: 7, maxHeight: 160, overflow: "auto" }}>{note.body}</p>
                      <div className="faint" style={{ fontSize: 10, marginTop: 8 }}>{courses.find((c) => c.id === note.courseId)?.name ?? "No course"} · {new Date(note.updatedAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "events" && (
            <Panel eyebrow="Seminars, labs, reviews" title="Academic events">
              {academicEvents.length === 0 ? <EmptyState icon={<CalendarDays size={20} />} title="No academic events" description="Workshops, lab sessions, project reviews and deadlines appear here." action={<button className="btn btn-primary btn-sm" onClick={() => setEventForm(true)}>Add event</button>} /> : (
                <div className="stack" style={{ gap: 0 }}>
                  {academicEvents.map((event) => (
                    <div className="list-row" key={event.id}>
                      <span className="badge badge-info">{event.kind}</span>
                      <div className="list-row-main"><strong>{event.title}</strong><small>{relativeDayLabel(event.starts_at)} · {formatTime(event.starts_at)}</small></div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </>
      )}

      {assignmentForm && semester && user && (
        <AssignmentForm
          semesterId={semester.id}
          userId={user.id}
          courses={courses}
          initial={assignmentForm === "new" ? undefined : assignmentForm}
          onSaved={() => void refresh()}
          onClose={() => setAssignmentForm(null)}
        />
      )}
      {eventForm && semester && user && (
        <EventForm
          semesterId={semester.id}
          userId={user.id}
          courses={courses}
          defaultKind="exam"
          onSaved={() => void refresh()}
          onClose={() => setEventForm(false)}
        />
      )}
      {noteFormOpen && (
        <Modal title={noteDraft.id ? "Edit note" : "New note"} onClose={() => setNoteFormOpen(false)}>
          <form className="stack" onSubmit={saveNote}>
            <Field label="Title"><input className="input" value={noteDraft.title} onChange={(e) => setNoteDraft({ ...noteDraft, title: e.target.value })} placeholder="Lecture summary" /></Field>
            <Field label="Course"><select className="select" value={noteDraft.courseId} onChange={(e) => setNoteDraft({ ...noteDraft, courseId: e.target.value })}><option value="">No course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Note" hint="Plain text, safely rendered — no HTML injection."><textarea className="textarea" rows={8} value={noteDraft.body} onChange={(e) => setNoteDraft({ ...noteDraft, body: e.target.value })} /></Field>
            <button className="btn btn-primary btn-block" type="submit">Save note</button>
          </form>
        </Modal>
      )}
      {deleteTarget && (
        <ConfirmDialog title="Delete assignment?" message={`Remove ${deleteTarget.title}? This cannot be undone.`} confirmLabel="Delete" danger onConfirm={() => void removeAssignment()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
}
