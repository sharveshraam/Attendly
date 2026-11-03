"use client";

import { useState } from "react";
import { Bell, CheckCheck, Info } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/data";

export default function NotificationsPage() {
  const { notifications, user, refresh } = useWorkspace();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function markAll() {
    if (!user) return;
    setBusy(true);
    try { await markAllNotificationsRead(user.id); await refresh(); toast.success("All notifications marked as read."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not update notifications."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader eyebrow="Inbox" title="Notifications" subtitle="Private to your account" actions={<button className="btn" disabled={busy} onClick={() => void markAll()}><CheckCheck size={14} /> Mark all read</button>} />
      <Panel eyebrow="Categories" title="All notifications">
        {notifications.length === 0 ? (
          <EmptyState icon={<Bell size={20} />} title="Nothing here yet" description="Schedule changes, attendance warnings and deadline reminders appear here." />
        ) : (
          <div className="stack" style={{ gap: 0 }}>
            {notifications.map((item) => (
              <button key={item.id} className="list-row" style={{ width: "100%", textAlign: "left", background: item.read_at ? "transparent" : "var(--accent-soft)", border: 0, borderBottom: "1px solid var(--border)" }} onClick={async () => { if (item.read_at) return; await markNotificationRead(item.id); await refresh(); }}>
                <span className="badge badge-info">{item.category}</span>
                <span className="list-row-main"><strong>{item.title}</strong><small>{item.body} · {new Date(item.created_at).toLocaleString()}</small></span>
                {!item.read_at && <span className="dot" style={{ background: "var(--accent)" }} />}
              </button>
            ))}
          </div>
        )}
      </Panel>
      <div className="alert" style={{ marginTop: 14 }}><Info size={15} /> Remote push delivery is not configured; these are in-app notifications with realtime updates.</div>
    </>
  );
}
