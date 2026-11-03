"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, ProgressBar, RiskBadge, ConfirmDialog } from "@/components/ui";
import { CourseForm } from "@/components/forms";
import { deleteCourse } from "@/lib/data";
import type { CourseRow } from "@/lib/types";

export default function CoursesPage() {
  const { semester, courses, stats, loading, error, refresh } = useWorkspace();
  const toast = useToast();
  const [editing, setEditing] = useState<CourseRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<CourseRow | null>(null);

  async function remove() {
    if (!deleting) return;
    try {
      await deleteCourse(deleting.id);
      toast.success("Course removed.");
      setDeleting(null);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not remove the course.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Your semester"
        title="Courses"
        subtitle={semester ? `${courses.length} course${courses.length === 1 ? "" : "s"} in ${semester.name}` : "Add a semester first."}
        actions={<button className="btn btn-primary" disabled={!semester} onClick={() => setEditing("new")}><Plus size={14} /> Add course</button>}
      />
      {loading ? <LoadingState rows={4} /> : error ? <ErrorState message={error} retry={() => void refresh()} /> : !semester ? (
        <Panel><EmptyState icon={<BookOpen size={20} />} title="No semester yet" description="Create a semester in onboarding before adding courses." action={<Link className="btn btn-primary" href="/onboarding">Start onboarding</Link>} /></Panel>
      ) : courses.length === 0 ? (
        <Panel><EmptyState icon={<BookOpen size={20} />} title="No courses yet" description="Add each subject you want to track. You can set a different attendance target per course." action={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={14} /> Add course</button>} /></Panel>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 13 }}>
          {courses.map((course) => {
            const stat = stats.find((item) => item.courseId === course.id);
            return (
              <div className="card" key={course.id}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span className="color-bar" style={{ background: course.color, minHeight: 40 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/courses/${course.id}`}><h3 style={{ fontSize: 14 }}>{course.name}</h3></Link>
                    <div className="faint" style={{ fontSize: 10.5, marginTop: 3 }}>{course.code || "No code"} · {course.category} · target {stat?.target ?? semester.attendance_target}%</div>
                  </div>
                  <RiskBadge risk={stat?.risk ?? "unknown"} />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "16px 0 8px" }}>
                  <span className="mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.05em" }}>{stat?.percent === null || !stat ? "—" : `${stat.percent}%`}</span>
                  <span className="muted" style={{ fontSize: 11 }}>attendance</span>
                </div>
                <ProgressBar value={stat?.percent ?? 0} tone={stat?.risk === "at_risk" ? "danger" : stat?.risk === "warning" ? "warning" : "success"} />
                <div className="muted" style={{ fontSize: 10.5, marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>{stat?.conducted ?? 0} conducted</span><span>{stat?.present ?? 0} attended</span><span>{stat?.absent ?? 0} missed</span><span>{stat?.unmarked ?? 0} unmarked</span>
                </div>
                <div style={{ display: "flex", gap: 7, marginTop: 16 }}>
                  <Link className="btn btn-sm btn-soft" href={`/courses/${course.id}`}>Open <BookOpen size={13} /></Link>
                  <button className="btn btn-sm" aria-label={`Edit ${course.name}`} onClick={() => setEditing(course)}><Pencil size={13} /></button>
                  <button className="btn btn-sm btn-danger" aria-label={`Delete ${course.name}`} onClick={() => setDeleting(course)}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && semester && (
        <CourseForm
          semesterId={semester.id}
          initial={editing === "new" ? undefined : editing}
          onSaved={() => void refresh()}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete course?"
          message={`This removes ${deleting.name} and its timetable rules, calendar sessions and attendance records linked to it. This cannot be undone.`}
          confirmLabel="Delete course"
          danger
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
