"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Plus, ShieldCheck, Users } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import { EmptyState, Field, Modal, PageHeader, Panel } from "@/components/ui";
import { createGroup, fetchMyGroups, joinGroupByInvite, type GroupWithRole } from "@/lib/data";
import { safeParse, groupSchema, inviteSchema } from "@/lib/validation";

export default function GroupsPage() {
  const { user, refresh: refreshWorkspace } = useWorkspace();
  const toast = useToast();
  const [groups, setGroups] = useState<GroupWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      setGroups(await fetchMyGroups(user.id));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not load groups.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const parsed = safeParse(groupSchema, { name });
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    try {
      await createGroup(parsed.data.name, user.id);
      toast.success("Group created. You are the owner.");
      setCreateOpen(false);
      setName("");
      await load();
      await refreshWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the group.");
    } finally {
      setBusy(false);
    }
  }

  async function submitJoin(event: React.FormEvent) {
    event.preventDefault();
    const parsed = safeParse(inviteSchema, invite);
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    try {
      await joinGroupByInvite(parsed.data);
      toast.success("Joined the group as a member.");
      setJoinOpen(false);
      setInvite("");
      await load();
      await refreshWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join. Check the invite code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Collaboration"
        title="Study groups"
        subtitle="Share timetables and academic calendars. Personal attendance is never shared."
        actions={<>
          <button className="btn" onClick={() => { setError(""); setJoinOpen(true); }}>Join with code</button>
          <button className="btn btn-primary" onClick={() => { setError(""); setCreateOpen(true); }}><Plus size={14} /> Create group</button>
        </>}
      />

      <div className="alert alert-success" style={{ marginBottom: 14 }}>
        <ShieldCheck size={15} /> Group pages query shared <code>calendar_events</code> only. No group view requests another member&rsquo;s attendance records, analytics or bunk calculations — the restriction is enforced by RLS.
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />
      ) : groups.length === 0 ? (
        <Panel><EmptyState icon={<Users size={20} />} title="No groups yet" description="Create a group and share its invite code, or join a classmate's group." /></Panel>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 13 }}>
          {groups.map((group) => (
            <div className="card" key={group.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div><h3 style={{ fontSize: 14 }}>{group.name}</h3><span className="faint" style={{ fontSize: 10.5 }}>Created {new Date(group.created_at).toLocaleDateString()}</span></div>
                <span className="badge badge-accent">{group.role}</span>
              </div>
              <div className="card-flat" style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div><span className="eyebrow">Invite code</span><div className="mono" style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em" }}>{group.invite_code}</div></div>
                <button className="btn btn-sm" aria-label="Copy invite code" onClick={async () => {
                  try { await navigator.clipboard.writeText(group.invite_code); toast.success("Invite code copied."); }
                  catch { toast.error("Clipboard unavailable. Copy the code manually."); }
                }}><Copy size={14} /></button>
              </div>
              <Link className="btn btn-soft btn-block" href={`/groups/${group.id}`} style={{ marginTop: 14 }}>Open group</Link>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <Modal title="Create a study group" onClose={() => setCreateOpen(false)}>
          <form className="stack" onSubmit={submitCreate}>
            <Field label="Group name"><input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="CSE Semester 5" /></Field>
            <div className="alert" style={{ fontSize: 11.5 }}>You become the owner. Members can view shared schedules and propose changes; owner/admin approval is required before a proposal becomes confirmed.</div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? "Creating…" : "Create group"}</button>
          </form>
        </Modal>
      )}

      {joinOpen && (
        <Modal title="Join a group" onClose={() => setJoinOpen(false)}>
          <form className="stack" onSubmit={submitJoin}>
            <Field label="Invite code" hint="Ask a group member for the code shown on their group card."><input className="input" required value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="A1B2C3D4E5" /></Field>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? "Joining…" : "Join group"}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
