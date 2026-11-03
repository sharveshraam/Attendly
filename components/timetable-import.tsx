"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Info, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/ui";
import {
  createCourse, createTimetableRules, deleteTimetableRule, updateTimetableRule,
  uploadDocument, upsertAcademicDays,
} from "@/lib/data";
import { parseAcademicDaysCsv, parseTimetableCsv, ACADEMIC_DAYS_CSV_TEMPLATE, TIMETABLE_CSV_TEMPLATE } from "@/lib/import/csv";
import { diffTimetables } from "@/lib/schedule";
import { validateUpload } from "@/lib/validation";
import { WEEKDAYS } from "@/lib/dates";
import type { AcademicDayDraft, AcademicDayRow, CourseRow, DocumentKind, TimetableDraftRow, TimetableRuleRow } from "@/lib/types";
import { COURSE_COLORS as COLORS } from "@/lib/theme";



export function TimetableImport({ semesterId, userId, courses, rules, onDone }: {
  semesterId: string; userId: string; courses: CourseRow[]; rules: TimetableRuleRow[]; onDone: () => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<DocumentKind>("timetable");
  const [rows, setRows] = useState<TimetableDraftRow[]>([]);
  const [days, setDays] = useState<AcademicDayDraft[]>([]);
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const existingDrafts = useMemo<TimetableDraftRow[]>(
    () => rules.map((rule) => ({
      id: rule.id,
      courseCode: courses.find((course) => course.id === rule.course_id)?.code ?? "",
      courseName: courses.find((course) => course.id === rule.course_id)?.name ?? "",
      weekday: rule.weekday,
      startTime: rule.starts_at.slice(0, 5),
      endTime: rule.ends_at.slice(0, 5),
      location: rule.location ?? "",
    })),
    [rules, courses],
  );

  const diff = useMemo(() => diffTimetables(existingDrafts, rows), [existingDrafts, rows]);

  async function handleFile(file: File) {
    setMessage("");
    setErrors([]);
    setRows([]);
    setDays([]);
    const check = validateUpload({ name: file.name, size: file.size, type: file.type });
    if (!check.ok) return setMessage(check.error);
    const extension = check.extension;

    // Always keep a private copy for provenance (never public).
    try {
      await uploadDocument(userId, semesterId, file, kind);
    } catch (error) {
      setMessage(error instanceof Error ? `Private storage upload failed: ${error.message}` : "Private storage upload failed.");
      return;
    }

    if (extension === "csv" && kind === "timetable") {
      const parsed = parseTimetableCsv(await file.text());
      setRows(parsed.rows);
      setErrors(parsed.errors);
      setMessage(parsed.rows.length ? `${parsed.rows.length} rows parsed. Review and correct every entry before applying.` : "No valid rows found.");
      return;
    }
    if (extension === "csv" && (kind === "academic_calendar" || kind === "exam_schedule")) {
      const parsed = parseAcademicDaysCsv(await file.text());
      setDays(parsed.rows);
      setErrors(parsed.errors);
      setMessage(parsed.rows.length ? `${parsed.rows.length} academic dates parsed. Review before saving.` : "No valid dates found.");
      return;
    }
    setMessage(
      "The file was stored in your private document folder. Automatic OCR / AI extraction is not available in this backend, so nothing was interpreted. Add the details manually or upload a CSV for local parsing.",
    );
  }

  function updateRow(index: number, patch: Partial<TimetableDraftRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { id: `manual-${Date.now()}`, courseCode: "", courseName: "", weekday: 1, startTime: "09:00", endTime: "10:00", location: "" },
    ]);
  }

  async function applyChanges() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      let added = 0;
      for (const item of diff.added) {
        const name = item.courseName.trim();
        if (!name) continue;
        let course = courses.find((c) => c.name.toLowerCase() === name.toLowerCase() || (item.courseCode && c.code?.toLowerCase() === item.courseCode.toLowerCase()));
        if (!course) {
          course = await createCourse({
            semester_id: semesterId,
            name,
            code: item.courseCode || null,
            color: COLORS[(courses.length + added) % COLORS.length],
          });
        }
        await createTimetableRules([{
          semester_id: semesterId,
          course_id: course.id,
          weekday: item.weekday,
          starts_at: item.startTime,
          ends_at: item.endTime,
          location: item.location || null,
          valid_from: null,
          valid_until: null,
        }]);
        added += 1;
      }
      for (const change of diff.changed) {
        const rule = rules.find((r) =>
          r.weekday === change.before.weekday &&
          r.starts_at.slice(0, 5) === change.before.startTime &&
          courses.find((c) => c.id === r.course_id)?.name === change.before.courseName,
        );
        if (!rule) continue;
        const course = courses.find((c) => c.name.toLowerCase() === change.after.courseName.toLowerCase());
        await updateTimetableRule(rule.id, {
          weekday: change.after.weekday,
          starts_at: change.after.startTime,
          ends_at: change.after.endTime,
          location: change.after.location || null,
          ...(course ? { course_id: course.id } : {}),
        });
      }
      toast.success(`${added} new rule${added === 1 ? "" : "s"} and ${diff.changed.length} change${diff.changed.length === 1 ? "" : "s"} applied.`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply the timetable.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMissing() {
    setBusy(true);
    try {
      for (const item of diff.removed) {
        const rule = rules.find((r) =>
          r.weekday === item.weekday &&
          r.starts_at.slice(0, 5) === item.startTime &&
          courses.find((c) => c.id === r.course_id)?.name === item.courseName,
        );
        if (rule) await deleteTimetableRule(rule.id);
      }
      toast.success(`${diff.removed.length} rule(s) removed.`);
      setConfirmRemove(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove rules.");
    } finally {
      setBusy(false);
    }
  }

  async function applyDays() {
    setBusy(true);
    try {
      await upsertAcademicDays(days.map((day) => ({ semester_id: semesterId, day: day.day, kind: day.kind, title: day.title || null, notes: null })));
      toast.success(`${days.length} academic date(s) saved.`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save academic dates.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="alert">
        <Info size={15} style={{ flex: "none" }} />
        <span style={{ fontSize: 11.5 }}>CSV is parsed locally and every row is shown below for human review. PDF, image and Excel files are stored privately but are <strong>not</strong> auto-extracted — no OCR/AI service exists in the backend. Nothing is written to your timetable until you confirm.</span>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <span>Document type</span>
          <select className="select" value={kind} onChange={(event) => setKind(event.target.value as DocumentKind)}>
            <option value="timetable">Timetable (CSV)</option>
            <option value="academic_calendar">Academic calendar (CSV)</option>
            <option value="exam_schedule">Exam schedule (CSV)</option>
            <option value="other">PDF / image / Excel (storage only)</option>
          </select>
        </label>
        <label className="btn btn-soft" style={{ cursor: "pointer" }}>
          <FileUp size={14} /> Choose file
          <input
            type="file"
            className="sr-only"
            accept=".csv,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
        </label>
        <button className="btn btn-sm" onClick={() => {
          const blob = new Blob([kind === "academic_calendar" || kind === "exam_schedule" ? ACADEMIC_DAYS_CSV_TEMPLATE : TIMETABLE_CSV_TEMPLATE], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = kind === "academic_calendar" || kind === "exam_schedule" ? "academic-days-template.csv" : "timetable-template.csv";
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Download CSV template</button>
      </div>

      {message && <div className="alert alert-accent" role="status"><CheckCircle2 size={15} /> <span>{message}</span></div>}
      {errors.length > 0 && (
        <div className="alert alert-warning" role="status">
          <AlertTriangle size={15} />
          <div><strong>{errors.length} row(s) were skipped</strong><ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 11 }}>{errors.slice(0, 8).map((item) => <li key={`${item.line}-${item.message}`}>Line {item.line}: {item.message}</li>)}</ul></div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="stack">
          <div className="panel-head">
            <div><span className="eyebrow">Human review</span><h3 className="section-title">Review extracted timetable rows</h3></div>
            <button className="btn btn-sm" onClick={addRow}><Plus size={13} /> Add row</button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Course code</th><th>Course name</th><th>Day</th><th>Start</th><th>End</th><th>Location</th><th /></tr></thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td><input className="input" style={{ minWidth: 90, minHeight: 32, padding: "5px 8px" }} value={row.courseCode} onChange={(e) => updateRow(index, { courseCode: e.target.value })} /></td>
                    <td><input className="input" style={{ minWidth: 150, minHeight: 32, padding: "5px 8px" }} value={row.courseName} onChange={(e) => updateRow(index, { courseName: e.target.value })} /></td>
                    <td><select className="select" style={{ minHeight: 32, padding: "5px 8px" }} value={row.weekday} onChange={(e) => updateRow(index, { weekday: Number(e.target.value) })}>{WEEKDAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</select></td>
                    <td><input className="input" type="time" style={{ minHeight: 32, padding: "5px 8px" }} value={row.startTime} onChange={(e) => updateRow(index, { startTime: e.target.value })} /></td>
                    <td><input className="input" type="time" style={{ minHeight: 32, padding: "5px 8px" }} value={row.endTime} onChange={(e) => updateRow(index, { endTime: e.target.value })} /></td>
                    <td><input className="input" style={{ minWidth: 100, minHeight: 32, padding: "5px 8px" }} value={row.location} onChange={(e) => updateRow(index, { location: e.target.value })} /></td>
                    <td><button className="btn btn-ghost btn-sm" aria-label="Remove row" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="alert alert-accent" style={{ fontSize: 11.5 }}>
            <span><strong>Diff against your existing schedule:</strong> {diff.added.length} added · {diff.changed.length} changed · {diff.removed.length} removed. Manually edited rules are preserved until you explicitly remove them.</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary" disabled={busy || (diff.added.length === 0 && diff.changed.length === 0)} onClick={() => void applyChanges()}>
              Apply {diff.added.length} addition(s) &amp; {diff.changed.length} change(s)
            </button>
            <button className="btn btn-danger" disabled={busy || diff.removed.length === 0} onClick={() => setConfirmRemove(true)}>Remove {diff.removed.length} missing rule(s)</button>
          </div>
        </div>
      )}

      {days.length > 0 && (
        <div className="stack">
          <div className="panel-head"><div><span className="eyebrow">Human review</span><h3 className="section-title">Review academic dates</h3></div></div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Date</th><th>Classification</th><th>Title</th></tr></thead>
              <tbody>
                {days.map((day, index) => (
                  <tr key={day.id}>
                    <td><input className="input" type="date" style={{ minHeight: 32, padding: "5px 8px" }} value={day.day} onChange={(e) => setDays((current) => current.map((item, i) => i === index ? { ...item, day: e.target.value } : item))} /></td>
                    <td>
                      <select className="select" style={{ minHeight: 32, padding: "5px 8px" }} value={day.kind} onChange={(e) => setDays((current) => current.map((item, i) => i === index ? { ...item, kind: e.target.value as AcademicDayRow["kind"] } : item))}>
                        {(["instructional", "non_instructional", "holiday", "exam", "closure", "special_working"] as const).map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
                      </select>
                    </td>
                    <td><input className="input" style={{ minHeight: 32, padding: "5px 8px" }} value={day.title} onChange={(e) => setDays((current) => current.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={() => void applyDays()}>Save {days.length} academic date(s)</button>
        </div>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove missing rules?"
          message={`This deletes ${diff.removed.length} weekly timetable rule(s) that are no longer in the imported file. Dated class sessions and attendance records are not deleted.`}
          confirmLabel="Remove rules"
          danger
          onConfirm={() => void removeMissing()}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}
