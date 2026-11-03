"use client";

import { useState } from "react";
import { Check, CircleDashed, MinusCircle, X } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import type { AttendanceStatus, SessionWithAttendance } from "@/lib/types";

const OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode; tone: string }[] = [
  { value: "present", label: "Present", icon: <Check size={13} />, tone: "var(--success)" },
  { value: "absent", label: "Absent", icon: <X size={13} />, tone: "var(--danger)" },
  { value: "excused", label: "Excused", icon: <MinusCircle size={13} />, tone: "var(--warning)" },
  { value: "unmarked", label: "Unmarked", icon: <CircleDashed size={13} />, tone: "var(--faint)" },
];

export function AttendanceMarker({ session, compact = false }: { session: SessionWithAttendance; compact?: boolean }) {
  const { markAttendance } = useWorkspace();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const current = session.record?.status ?? "unmarked";

  async function choose(status: AttendanceStatus) {
    if (busy) return;
    setBusy(true);
    try {
      await markAttendance(session.event.id, status, session.record?.attended_minutes ?? null, session.record?.note ?? null);
      toast.success(`Marked ${session.event.title} as ${status}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the mark.");
    } finally {
      setBusy(false);
    }
  }

  if (session.event.status === "cancelled" || session.event.status === "rescheduled") {
    return <span className="badge">{session.event.status}</span>;
  }

  return (
    <div className="segmented" role="group" aria-label={`Attendance for ${session.event.title}`}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={current === option.value}
          disabled={busy}
          onClick={() => void choose(option.value)}
          style={{ color: current === option.value ? option.tone : undefined }}
          title={option.label}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {option.icon}
            {!compact && option.label}
          </span>
        </button>
      ))}
    </div>
  );
}
