"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, ClipboardList, Search, Settings2, Sparkles, Users, BarChart3, LayoutDashboard } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";

interface Result {
  id: string;
  label: string;
  detail: string;
  href: string;
  icon: React.ReactNode;
  group: string;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { courses, events, assignments } = useWorkspace();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const results = useMemo<Result[]>(() => {
    const nav: Result[] = [
      { id: "nav-home", label: "Home", detail: "Dashboard", href: "/home", icon: <LayoutDashboard size={15} />, group: "Navigation" },
      { id: "nav-calendar", label: "Calendar", detail: "Month, week, day and agenda", href: "/calendar", icon: <CalendarDays size={15} />, group: "Navigation" },
      { id: "nav-attendance", label: "Attendance", detail: "Marks, bunk & recovery", href: "/attendance", icon: <BarChart3 size={15} />, group: "Navigation" },
      { id: "nav-courses", label: "Courses", detail: "Course list", href: "/courses", icon: <BookOpen size={15} />, group: "Navigation" },
      { id: "nav-groups", label: "Groups", detail: "Shared schedules", href: "/groups", icon: <Users size={15} />, group: "Navigation" },
      { id: "nav-productivity", label: "Productivity", detail: "Assignments, exams, notes", href: "/productivity", icon: <ClipboardList size={15} />, group: "Navigation" },
      { id: "nav-analytics", label: "Analytics", detail: "Trends and exports", href: "/analytics", icon: <BarChart3 size={15} />, group: "Navigation" },
      { id: "nav-assistant", label: "AI Assistant", detail: "Ask about your data", href: "/assistant", icon: <Sparkles size={15} />, group: "Navigation" },
      { id: "nav-settings", label: "Settings", detail: "Profile, theme, privacy", href: "/settings", icon: <Settings2 size={15} />, group: "Navigation" },
    ];
    const courseResults: Result[] = courses.map((course) => ({
      id: `course-${course.id}`, label: course.name, detail: course.code ?? "Course", href: `/courses/${course.id}`,
      icon: <BookOpen size={15} />, group: "Courses",
    }));
    const eventResults: Result[] = events.slice(0, 80).map((event) => ({
      id: `event-${event.id}`, label: event.title, detail: `${event.kind} · ${new Date(event.starts_at).toLocaleDateString()}`,
      href: `/calendar?event=${event.id}`, icon: <CalendarDays size={15} />, group: "Calendar",
    }));
    const assignmentResults: Result[] = assignments.map((item) => ({
      id: `assignment-${item.id}`, label: item.title, detail: item.due_at ? `Due ${new Date(item.due_at).toLocaleDateString()}` : "No due date",
      href: "/productivity", icon: <ClipboardList size={15} />, group: "Assignments",
    }));
    const all = [...nav, ...courseResults, ...eventResults, ...assignmentResults];
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? all.filter((item) => `${item.label} ${item.detail} ${item.group}`.toLowerCase().includes(needle))
      : all.filter((item) => item.group === "Navigation");
    return filtered.slice(0, 30);
  }, [query, courses, events, assignments]);

  if (!open) return null;
  const groups = [...new Set(results.map((item) => item.group))];

  return (
    <div className="modal-backdrop" style={{ alignItems: "start", paddingTop: "12vh" }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Search Attendly" style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <Search size={17} style={{ color: "var(--faint)" }} />
          <input
            ref={inputRef}
            className="input"
            style={{ border: 0, boxShadow: "none", padding: 0, background: "transparent" }}
            placeholder="Search courses, classes, assignments…"
            aria-label="Search Attendly"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd className="badge">ESC</kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto", padding: "8px" }}>
          {results.length === 0 && <p className="muted" style={{ padding: 18, textAlign: "center", fontSize: 12 }}>No matches. Try a course name or “calendar”.</p>}
          {groups.map((group) => (
            <div key={group}>
              <div className="eyebrow" style={{ padding: "8px 10px 4px" }}>{group}</div>
              {results.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  className="btn btn-ghost btn-block"
                  style={{ justifyContent: "flex-start", minHeight: 40, fontWeight: 500 }}
                  onClick={() => { router.push(item.href); onClose(); }}
                >
                  <span style={{ color: "var(--accent)", display: "grid", placeItems: "center" }}>{item.icon}</span>
                  <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                  <span className="faint" style={{ fontSize: 10.5 }}>{item.detail}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
