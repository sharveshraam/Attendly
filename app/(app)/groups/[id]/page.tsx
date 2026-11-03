"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Copy, History, Plus, ShieldCheck, Users, X } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import { EmptyState, Field, LoadingState, Modal, PageHeader, Panel, Segmented } from "@/components/ui";
import {
  createEvents, createPoll, createSemester, fetchChangeLog, fetchGroupEvents, fetchGroupMembers,
  fetchMyGroups, fetchPollVotes, fetchPolls, removeMember, setEventVerification, setMemberRole, votePoll,
  type GroupWithRole,
} from "@/lib/data";
import { fromDateTimeLocal, formatDate, formatTime } from "@/lib/dates";
import { safeParse, eventSchema, shortText } from "@/lib/validation";
import type {
  CalendarEventRow, CalendarPollRow, CalendarPollVoteRow, GroupMemberRow, ScheduleChangeLogRow, SemesterRow,
} from "@/lib/types";

type Tab = "schedule" | "proposals" | "polls" | "members" | "history";

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const { user, semesters, refresh: refreshWorkspace } = useWorkspace();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("schedule");
  const [group, setGroup] = useState<GroupWithRole | null>(null);
  const [members, setMembers] = useState<(GroupMemberRow & { display_name: string | null })[]>([]);
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [polls, setPolls] = useState<CalendarPollRow[]>([]);
  const [votes, setVotes] = useState<CalendarPollVoteRow[]>([]);
  const [history, setHistory] = useState<ScheduleChangeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [proposal, setProposal] = useState({ title: "", starts_at: "", ends_at: "", location: "", description: "" });
  const [pollDraft, setPollDraft] = useState({ title: "", options: "Option A\nOption B" });
  const [error, setError] = useState("");

  const groupSemester: SemesterRow | null = semesters.find((item) => item.group_id === groupId) ?? null;
  const myRole = group?.role ?? "member";
  const canManage = myRole === "owner" || myRole === "admin";

  const userId = user?.id ?? null;
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [myGroups, memberRows, eventRows, pollRows] = await Promise.all([
        fetchMyGroups(userId),
        fetchGroupMembers(groupId),
        fetchGroupEvents(groupId),
        fetchPolls(groupId),
      ]);
      setGroup(myGroups.find((item) => item.id === groupId) ?? null);
      setMembers(memberRows);
      setEvents(eventRows);
      setPolls(pollRows);
      setVotes(pollRows.length ? await fetchPollVotes(pollRows.map((poll) => poll.id)) : []);
      const linked = semesters.find((item) => item.group_id === groupId);
      if (linked) setHistory(await fetchChangeLog(linked.id, 50));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not load this group.");
    } finally {
      setLoading(false);
    }
  }, [userId, groupId, semesters, toast]);

  useEffect(() => { void load(); }, [load]);

  async function createSharedSemester() {
    if (!user || !group) return;
    setBusy(true);
    try {
      await createSemester({
        owner_id: user.id,
        group_id: group.id,
        name: `${group.name} shared schedule`,
        start_date: new Date().toISOString().slice(0, 10),
        attendance_target: 75,
        prediction_mode: "rolling",
      });
      toast.success("Shared semester created. You can now propose schedule changes.");
      await load();
      await refreshWorkspace();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not create the shared semester.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProposal(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !groupSemester) return;
    setError("");
    const parsed = safeParse(eventSchema, {
      title: proposal.title,
      kind: "class",
      starts_at: fromDateTimeLocal(proposal.starts_at),
      ends_at: fromDateTimeLocal(proposal.ends_at),
      location: proposal.location || null,
      description: proposal.description || null,
      status: "scheduled",
    });
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    try {
      await createEvents([{
        semester_id: groupSemester.id,
        group_id: groupId,
        created_by: user.id,
        ...parsed.data,
        source: "group-proposal",
        verification_status: canManage ? "confirmed" : "proposed",
      }]);
      toast.success(canManage ? "Shared event added." : "Proposal submitted for owner/admin approval.");
      setProposalOpen(false);
      setProposal({ title: "", starts_at: "", ends_at: "", location: "", description: "" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit the proposal.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(eventId: string, status: "confirmed" | "rejected") {
    if (!user) return;
    try {
      await setEventVerification(eventId, status, user.id);
      toast.success(status === "confirmed" ? "Proposal approved." : "Proposal rejected.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update the proposal.");
    }
  }

  async function submitPoll(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const title = safeParse(shortText(160), pollDraft.title);
    if (!title.ok) return setError(title.error);
    const options = pollDraft.options.split("\n").map((line) => line.trim()).filter(Boolean);
    if (options.length < 2) return setError("Add at least two options.");
    setBusy(true);
    try {
      await createPoll({ group_id: groupId, created_by: user.id, title: title.data, options });
      toast.success("Poll created.");
      setPollOpen(false);
      setPollDraft({ title: "", options: "Option A\nOption B" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the poll.");
    } finally {
      setBusy(false);
    }
  }

  async function castVote(pollId: string, optionIndex: number) {
    if (!user) return;
    try {
      await votePoll(pollId, user.id, optionIndex);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not record your vote.");
    }
  }

  async function changeRole(member: GroupMemberRow & { display_name: string | null }, role: "admin" | "member") {
    try {
      await setMemberRole(groupId, member.user_id, role);
      toast.success("Member role updated.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Only the owner can change roles.");
    }
  }

  async function kick(member: GroupMemberRow & { display_name: string | null }) {
    try {
      await removeMember(groupId, member.user_id);
      toast.success("Member removed.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not remove the member.");
    }
  }

  if (loading) return <LoadingState rows={5} />;
  if (!group) {
    return <Panel><EmptyState icon={<Users size={20} />} title="Group not found" description="You may not be a member of this group, or the invite has changed." action={<Link className="btn btn-primary" href="/groups">Back to groups</Link>} /></Panel>;
  }

  const proposed = events.filter((event) => event.verification_status === "proposed");
  const confirmed = events.filter((event) => event.verification_status === "confirmed");

  return (
    <>
      <PageHeader
        eyebrow="Study group"
        title={group.name}
        subtitle={`Your role: ${group.role} · ${members.length} member${members.length === 1 ? "" : "s"}`}
        actions={<>
          <Link className="btn" href="/groups"><ArrowLeft size={14} /> All groups</Link>
          <button className="btn btn-primary" disabled={!groupSemester} onClick={() => { setError(""); setProposalOpen(true); }}><Plus size={14} /> Propose change</button>
        </>}
      />

      <div className="alert alert-success" style={{ marginBottom: 14 }}>
        <ShieldCheck size={15} /> Shared schedules only. This page never queries attendance records, private analytics or personal bunk calculations for any member.
      </div>

      <div className="card" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span className="eyebrow">Invite code</span>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.1em" }}>{group.invite_code}</div>
        </div>
        <button className="btn btn-sm" onClick={async () => {
          try { await navigator.clipboard.writeText(group.invite_code); toast.success("Invite code copied."); }
          catch { toast.error("Clipboard unavailable."); }
        }}><Copy size={14} /> Copy code</button>
        {canManage && (
          <button className="btn btn-sm" onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent(`Join ${group.name} on Attendly`)}&body=${encodeURIComponent(`Join with code ${group.invite_code}`)}`; }}>Invite by email</button>
        )}
      </div>

      {!groupSemester && (
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          <span style={{ flex: 1 }}>This group has no linked semester yet, so shared schedule entries cannot be created. {canManage ? "Create one below." : "Ask an owner or admin to create one."}</span>
          {canManage && <button className="btn btn-sm" disabled={busy} onClick={() => void createSharedSemester()}>Create shared semester</button>}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Segmented<Tab> label="Group section" value={tab} onChange={setTab} options={[
          { value: "schedule", label: "Shared schedule" },
          { value: "proposals", label: `Proposals${proposed.length ? ` (${proposed.length})` : ""}` },
          { value: "polls", label: "Polls" },
          { value: "members", label: "Members" },
          { value: "history", label: "History" },
        ]} />
      </div>

      {tab === "schedule" && (
        <Panel eyebrow="Approved" title="Shared calendar" action={<span className="badge">{confirmed.length} entries</span>}>
          {confirmed.length === 0 ? <EmptyState title="No shared entries yet" description="Approved schedule changes and shared events appear here." /> : (
            <div className="stack" style={{ gap: 0 }}>
              {confirmed.map((event) => (
                <div className="list-row" key={event.id}>
                  <span className="badge badge-accent">{event.kind}</span>
                  <div className="list-row-main"><strong>{event.title}</strong><small>{formatDate(event.starts_at)} · {formatTime(event.starts_at)} – {formatTime(event.ends_at)}{event.location ? ` · ${event.location}` : ""}</small></div>
                  <span className="badge badge-success">{event.status}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "proposals" && (
        <Panel eyebrow="Approval workflow" title="Schedule change proposals" action={<button className="btn btn-sm btn-primary" disabled={!groupSemester} onClick={() => setProposalOpen(true)}><Plus size={13} /> New proposal</button>}>
          {proposed.length === 0 ? <EmptyState title="No pending proposals" description="Members can propose a change; owner/admin approval is required before it becomes a confirmed shared entry." /> : (
            <div className="stack" style={{ gap: 0 }}>
              {proposed.map((event) => (
                <div className="list-row" key={event.id}>
                  <span className="badge badge-warning">Proposed</span>
                  <div className="list-row-main"><strong>{event.title}</strong><small>{formatDate(event.starts_at)} · {formatTime(event.starts_at)}</small></div>
                  {canManage && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm btn-soft" onClick={() => void decide(event.id, "confirmed")}><Check size={13} /> Approve</button>
                      <button className="btn btn-sm btn-danger" onClick={() => void decide(event.id, "rejected")}><X size={13} /> Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "polls" && (
        <Panel eyebrow="Collaborative planning" title="Group polls" action={<button className="btn btn-sm btn-primary" onClick={() => { setError(""); setPollOpen(true); }}><Plus size={13} /> New poll</button>}>
          {polls.length === 0 ? <EmptyState title="No polls yet" description="Create a poll to agree on a class time or schedule change." /> : (
            <div className="stack">
              {polls.map((poll) => {
                const options = Array.isArray(poll.options) ? (poll.options as string[]) : [];
                const pollVotes = votes.filter((vote) => vote.poll_id === poll.id);
                return (
                  <div className="card-flat" key={poll.id}>
                    <strong style={{ fontSize: 13 }}>{poll.title}</strong>
                    <div className="faint" style={{ fontSize: 10.5, marginBottom: 8 }}>{new Date(poll.created_at).toLocaleString()}</div>
                    <div className="stack" style={{ gap: 6 }}>
                      {options.map((option, index) => {
                        const count = pollVotes.filter((vote) => vote.option_index === index).length;
                        const mine = pollVotes.find((vote) => vote.user_id === user?.id)?.option_index === index;
                        return (
                          <button key={`${option}-${index}`} className={`btn btn-sm btn-block ${mine ? "btn-soft" : ""}`} style={{ justifyContent: "space-between" }} onClick={() => void castVote(poll.id, index)}>
                            <span>{option}</span><span className="badge">{count} vote{count === 1 ? "" : "s"}{mine ? " · yours" : ""}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {tab === "members" && (
        <Panel eyebrow="Membership" title="Group members">
          <div className="alert" style={{ marginBottom: 12, fontSize: 11.5 }}>Profile names are self-readable only under the current RLS policy, so other members appear as &ldquo;Classmate&rdquo;. This is expected and does not expose private data.</div>
          <div className="stack" style={{ gap: 0 }}>
            {members.map((member) => (
              <div className="list-row" key={member.user_id}>
                <span className="avatar avatar-sm">{(member.display_name ?? "C").slice(0, 1).toUpperCase()}</span>
                <div className="list-row-main"><strong>{member.display_name ?? "Classmate"}</strong><small>Joined {new Date(member.joined_at).toLocaleDateString()}</small></div>
                <span className="badge badge-accent">{member.role}</span>
                {myRole === "owner" && member.role !== "owner" && (
                  <div style={{ display: "flex", gap: 5 }}>
                    <button className="btn btn-sm" onClick={() => void changeRole(member, member.role === "admin" ? "member" : "admin")}>{member.role === "admin" ? "Demote" : "Promote"}</button>
                    <button className="btn btn-sm btn-danger" aria-label="Remove member" onClick={() => void kick(member)}><X size={13} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === "history" && (
        <Panel eyebrow="Audit trail" title="Approved change history">
          {history.length === 0 ? <EmptyState icon={<History size={20} />} title="No changes recorded" description="Schedule changes on the group-linked semester are logged here." /> : (
            <div className="stack" style={{ gap: 0 }}>
              {history.map((item) => (
                <div className="list-row" key={item.id}>
                  <span className="badge badge-info">{item.action.replace(/[._]/g, " ")}</span>
                  <div className="list-row-main"><strong>{String((item.after_data as Record<string, unknown> | null)?.title ?? item.action)}</strong><small>{new Date(item.created_at).toLocaleString()}</small></div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {proposalOpen && (
        <Modal title="Propose a schedule change" onClose={() => setProposalOpen(false)}>
          <form className="stack" onSubmit={submitProposal}>
            <div className="alert" style={{ fontSize: 11.5 }}>{canManage ? "As an owner/admin your entry is added as confirmed." : "Your entry is added as a proposal and only becomes confirmed after owner/admin approval."} No attendance records are affected.</div>
            <Field label="Title"><input className="input" required value={proposal.title} onChange={(e) => setProposal({ ...proposal, title: e.target.value })} placeholder="Extra class / cancelled session" /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Starts"><input className="input" type="datetime-local" required value={proposal.starts_at} onChange={(e) => setProposal({ ...proposal, starts_at: e.target.value })} /></Field>
              <Field label="Ends"><input className="input" type="datetime-local" required value={proposal.ends_at} onChange={(e) => setProposal({ ...proposal, ends_at: e.target.value })} /></Field>
            </div>
            <Field label="Location" hint="Optional"><input className="input" value={proposal.location} onChange={(e) => setProposal({ ...proposal, location: e.target.value })} /></Field>
            <Field label="Description"><textarea className="textarea" value={proposal.description} onChange={(e) => setProposal({ ...proposal, description: e.target.value })} /></Field>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? "Submitting…" : "Submit"}</button>
          </form>
        </Modal>
      )}

      {pollOpen && (
        <Modal title="Create a group poll" onClose={() => setPollOpen(false)}>
          <form className="stack" onSubmit={submitPoll}>
            <Field label="Question"><input className="input" required value={pollDraft.title} onChange={(e) => setPollDraft({ ...pollDraft, title: e.target.value })} placeholder="When should we hold the extra lab?" /></Field>
            <Field label="Options" hint="One option per line, at least two"><textarea className="textarea" required value={pollDraft.options} onChange={(e) => setPollDraft({ ...pollDraft, options: e.target.value })} /></Field>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? "Creating…" : "Create poll"}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
