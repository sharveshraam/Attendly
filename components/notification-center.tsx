"use client";

import { useMemo, useState } from "react";
import { Bell, BellRing, CheckCheck, Info, X } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/data";
import { useToast } from "@/components/toast";

const CATEGORY_LABELS: Record<string, string> = {
  class: "Class", schedule: "Schedule", attendance: "Attendance",
  assignment: "Assignment", exam: "Exam", group: "Group", system: "System",
};

export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, refresh, user } = useWorkspace();
  const toast = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);

  const categories = useMemo(
    () => ["all", ...[...new Set(notifications.map((item) => item.category))]],
    [notifications],
  );
  const visible = filter === "all" ? notifications : notifications.filter((item) => item.category === filter);

  async function markOne(id: string) {
    try {
      await markNotificationRead(id);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the notification.");
    }
  }

  async function markAll() {
    if (!user) return;
    setBusy(true);
    try {
      await markAllNotificationsRead(user.id);
      await refresh();
      toast.success("All notifications marked as read.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Notifications">
        <header className="drawer-head">
          <div>
            <h2 style={{ fontSize: 15 }}>Notifications</h2>
            <span className="faint" style={{ fontSize: 11 }}>Everything here is private to your account.</span>
          </div>
          <button className="btn btn-ghost btn-icon" aria-label="Close notifications" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="drawer-body">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {categories.map((category) => (
              <button
                key={category}
                className={`badge ${filter === category ? "badge-accent" : ""}`}
                style={{ border: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => setFilter(category)}
              >
                {category === "all" ? "All" : CATEGORY_LABELS[category] ?? category}
              </button>
            ))}
            <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void markAll()}>
              <CheckCheck size={13} /> Mark all read
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="empty">
              <span className="empty-icon"><BellRing size={20} /></span>
              <h3>You&rsquo;re all caught up</h3>
              <p>Schedule changes, attendance warnings and deadline reminders will appear here.</p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 2 }}>
              {visible.map((item) => (
                <button
                  key={item.id}
                  className="card-flat"
                  style={{ textAlign: "left", border: "1px solid var(--border)", background: item.read_at ? "transparent" : "var(--accent-soft)", cursor: "pointer" }}
                  onClick={() => void markOne(item.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Bell size={14} style={{ color: item.read_at ? "var(--faint)" : "var(--accent)" }} />
                    <strong style={{ fontSize: 12.5, flex: 1 }}>{item.title}</strong>
                    {!item.read_at && <span className="dot" style={{ background: "var(--accent)" }} />}
                  </div>
                  <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{item.body}</p>
                  <div className="faint" style={{ fontSize: 10, marginTop: 7, display: "flex", gap: 8 }}>
                    <span>{CATEGORY_LABELS[item.category] ?? item.category}</span>
                    <span>·</span>
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                    {!item.read_at && <span style={{ marginLeft: "auto" }}>Click to mark read</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="alert" style={{ marginTop: 22 }}>
            <Info size={15} style={{ flex: "none" }} />
            <div>
              <strong style={{ fontSize: 11.5 }}>Remote push is not configured</strong>
              <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                The existing backend has a `push_subscriptions` table but no delivery service (verified: no Edge Functions). Attendly therefore does not promise background push delivery. In-app notifications, realtime updates and optional in-tab reminders are available instead.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
