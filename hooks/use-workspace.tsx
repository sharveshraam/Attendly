"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "./use-now";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { summarize } from "@/lib/attendance/engine";
import { eventMinutes } from "@/lib/dates";
import {
  client,
  fetchAcademicDays,
  fetchAssignments,
  fetchAttendance,
  fetchChangeLog,
  fetchCourseResources,
  fetchCourses,
  fetchDocuments,
  fetchEvents,
  fetchMyGroups,
  fetchNotificationPreferences,
  fetchNotifications,
  fetchProfile,
  fetchSemesters,
  fetchTimetableRules,
  getCurrentUser,
  type GroupWithRole,
} from "@/lib/data";
import {
  enqueueAttendance,
  isOfflineCacheEnabled,
  pendingMarksByEvent,
  readOps,
  readPrivateCache,
  resolveConflict as resolveConflictOp,
  syncOutbox,
  writePrivateCache,
  type OutboxOp,
} from "@/lib/offline";
import type {
  AcademicDayRow,
  AssignmentRow,
  AttendanceRecordRow,
  AttendanceStatus,
  CalendarEventRow,
  CourseAttendanceStats,
  CourseResourceRow,
  CourseRow,
  DocumentUploadRow,
  NotificationPreferencesRow,
  NotificationRow,
  ProfileRow,
  ScheduleChangeLogRow,
  SemesterRow,
  SessionWithAttendance,
  TimetableRuleRow,
} from "@/lib/types";

const ACTIVE_SEMESTER_KEY = "attendly.active-semester.v1";

interface Snapshot {
  semesters: SemesterRow[];
  courses: CourseRow[];
  rules: TimetableRuleRow[];
  academicDays: AcademicDayRow[];
  events: CalendarEventRow[];
  records: AttendanceRecordRow[];
  assignments: AssignmentRow[];
  notifications: NotificationRow[];
  preferences: NotificationPreferencesRow | null;
  groups: GroupWithRole[];
  resources: CourseResourceRow[];
  documents: DocumentUploadRow[];
  changeLog: ScheduleChangeLogRow[];
}

const EMPTY: Snapshot = {
  semesters: [], courses: [], rules: [], academicDays: [], events: [], records: [],
  assignments: [], notifications: [], preferences: null, groups: [], resources: [],
  documents: [], changeLog: [],
};

interface WorkspaceContextValue extends Snapshot {
  user: User | null;
  profile: ProfileRow | null;
  semester: SemesterRow | null;
  setActiveSemester: (id: string) => void;
  loading: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  syncing: boolean;
  conflicts: OutboxOp[];
  pendingCount: number;
  offlineView: boolean;
  unreadCount: number;
  effectiveRecords: AttendanceRecordRow[];
  sessions: SessionWithAttendance[];
  stats: CourseAttendanceStats[];
  overall: ReturnType<typeof summarize> | null;
  refresh: () => Promise<void>;
  markAttendance: (eventId: string, status: AttendanceStatus, attendedMinutes?: number | null, note?: string | null) => Promise<void>;
  syncNow: () => Promise<void>;
  resolveConflict: (opId: string, choice: "keep-local" | "discard-local") => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const now = useNow();
  const [offlineView, setOfflineView] = useState(false);
  const [conflicts, setConflicts] = useState<OutboxOp[]>([]);
  const [pendingVersion, setPendingVersion] = useState(0);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  const refreshing = useRef(false);
  const refreshTimer = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);

  const bumpPending = useCallback(() => setPendingVersion((value) => value + 1), []);

  const setActiveSemester = useCallback((id: string) => {
    setActiveSemesterId(id);
    try {
      localStorage.setItem(ACTIVE_SEMESTER_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    setError(null);
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setUser(null);
        setSnapshot(EMPTY);
        setOfflineView(false);
        return;
      }
      setUser(currentUser);
      userIdRef.current = currentUser.id;
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline && isOfflineCacheEnabled()) {
        const cached = readPrivateCache<Snapshot>(currentUser.id, "workspace");
        if (cached) {
          setSnapshot(cached.value);
          setOfflineView(true);
          setLastSyncedAt(cached.savedAt);
          return;
        }
      }
      setOfflineView(false);

      let storedSemesterId: string | null = null;
      try {
        storedSemesterId = localStorage.getItem(ACTIVE_SEMESTER_KEY);
        if (storedSemesterId && !activeSemesterId) setActiveSemesterId(storedSemesterId);
      } catch {
        /* ignore */
      }

      const [profileRow, semesters, groups, notifications, preferences] = await Promise.all([
        fetchProfile(currentUser.id).catch(() => null),
        fetchSemesters(currentUser.id),
        fetchMyGroups(currentUser.id).catch(() => []),
        fetchNotifications(100).catch(() => []),
        fetchNotificationPreferences(currentUser.id).catch(() => null),
      ]);
      setProfile(profileRow);
      const chosenId = activeSemesterId ?? storedSemesterId;
      const semesterId = chosenId && semesters.some((item) => item.id === chosenId)
        ? chosenId
        : (semesters[0]?.id ?? null);

      let rest: Omit<Snapshot, "semesters" | "groups" | "notifications" | "preferences"> = {
        courses: [], rules: [], academicDays: [], events: [], records: [], assignments: [],
        resources: [], documents: [], changeLog: [],
      };
      if (semesterId) {
        const [courses, rules, academicDays, events, assignments, documents, changeLog] = await Promise.all([
          fetchCourses(semesterId),
          fetchTimetableRules(semesterId),
          fetchAcademicDays(semesterId),
          fetchEvents(semesterId),
          fetchAssignments(semesterId),
          fetchDocuments(semesterId).catch(() => []),
          fetchChangeLog(semesterId, 60).catch(() => []),
        ]);
        const [records, resources] = await Promise.all([
          fetchAttendance(currentUser.id, events.map((event) => event.id)),
          fetchCourseResources(courses.map((course) => course.id)).catch(() => []),
        ]);
        rest = { courses, rules, academicDays, events, records, assignments, resources, documents, changeLog };
      }

      const next: Snapshot = {
        semesters, groups, notifications, preferences,
        ...rest,
      };
      setSnapshot(next);
      setLastSyncedAt(new Date().toISOString());
      writePrivateCache(currentUser.id, "workspace", next);
    } catch (cause) {
      const fallback = readPrivateCache<Snapshot>(userIdRef.current ?? "", "workspace");
      if (fallback) {
        setSnapshot(fallback.value);
        setOfflineView(true);
        setLastSyncedAt(fallback.savedAt);
        setError(null);
      } else {
        setError(cause instanceof Error ? cause.message : "Could not load your workspace.");
      }
    } finally {
      setLoading(false);
      refreshing.current = false;
    }
  }, [activeSemesterId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Realtime: any authorized change invalidates the single workspace query. */
  useEffect(() => {
    const supabase = createClient();
    const scheduleRefresh = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void refresh(), 900);
    };
    const channel = supabase
      .channel("attendly-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_polls" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_poll_votes" }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const syncNow = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const result = await syncOutbox(client(), user.id);
      setConflicts(readOps().filter((op) => op.state === "conflict"));
      bumpPending();
      if (result.synced > 0 || result.conflicts > 0 || result.failed > 0) await refresh();
    } finally {
      setSyncing(false);
    }
  }, [user, refresh, bumpPending]);

  useEffect(() => {
    const onOnline = () => {
      void syncNow().then(() => void refresh());
    };
    window.addEventListener("attendly:online", onOnline);
    const initial = window.setTimeout(() => void syncNow(), 1200);
    return () => {
      window.removeEventListener("attendly:online", onOnline);
      window.clearTimeout(initial);
    };
  }, [syncNow, refresh]);

  useEffect(() => {
    setConflicts(readOps().filter((op) => op.state === "conflict"));
  }, [pendingVersion]);

  const markAttendance = useCallback(
    async (eventId: string, status: AttendanceStatus, attendedMinutes?: number | null, note?: string | null) => {
      if (!user) throw new Error("Sign in to mark attendance.");
      const existing = snapshot.records.find((record) => record.event_id === eventId) ?? null;
      enqueueAttendance({
        eventId,
        status,
        attendedMinutes: attendedMinutes ?? null,
        note: note ?? null,
        baseRecordId: existing?.id ?? null,
        baseMarkedAt: existing?.marked_at ?? null,
      });
      bumpPending();
      if (navigator.onLine) {
        await syncNow();
      } else {
        // Optimistic local record is provided by the pending overlay below.
        setLastSyncedAt(null);
      }
    },
    [user, snapshot.records, syncNow, bumpPending],
  );

  const resolveConflict = useCallback(
    async (opId: string, choice: "keep-local" | "discard-local") => {
      // Explicit user confirmation is required before overwriting a newer row.
      // The outbox then performs the same idempotent upsert as any other mark,
      // so conflict resolution cannot bypass duplicate/conflict protections.
      resolveConflictOp(opId, choice);
      bumpPending();
      await syncNow();
      await refresh();
    },
    [syncNow, bumpPending, refresh],
  );

  const semester = useMemo(() => {
    if (activeSemesterId) {
      const found = snapshot.semesters.find((item) => item.id === activeSemesterId);
      if (found) return found;
    }
    return snapshot.semesters[0] ?? null;
  }, [snapshot.semesters, activeSemesterId]);

  // pendingVersion is the localStorage invalidation counter; it is intentionally
  // the only dependency even though the callback does not read it directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pending = useMemo(() => pendingMarksByEvent(), [pendingVersion]);

  const effectiveRecords = useMemo(() => {
    const map = new Map(snapshot.records.map((record) => [record.event_id, record]));
    for (const [eventId, mark] of pending) {
      const base = map.get(eventId);
      map.set(eventId, {
        id: base?.id ?? `pending-${eventId}`,
        user_id: user?.id ?? "",
        event_id: eventId,
        status: mark.status,
        attended_minutes: mark.attendedMinutes,
        note: mark.note,
        marked_at: mark.localMarkedAt,
      });
    }
    return [...map.values()];
  }, [snapshot.records, pending, user?.id]);

  const sessions = useMemo<SessionWithAttendance[]>(() => {
    const recordByEvent = new Map(effectiveRecords.map((record) => [record.event_id, record]));
    return snapshot.events
      .filter((event) => event.kind === "class")
      .map((event) => {
        const record = recordByEvent.get(event.id) ?? null;
        const effectiveStatus: SessionWithAttendance["effectiveStatus"] =
          event.status === "cancelled"
            ? "cancelled"
            : event.status === "rescheduled"
              ? "rescheduled"
              : (record?.status ?? "unmarked");
        return {
          event,
          record,
          effectiveStatus,
          pendingSync: pending.has(event.id),
        };
      })
      .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
  }, [snapshot.events, effectiveRecords, pending]);

  const stats = useMemo<CourseAttendanceStats[]>(() => {
    const defaultTarget = semester?.attendance_target ?? 75;
    return snapshot.courses.map((course) => {
      const courseSessions = sessions.filter((session) => session.event.course_id === course.id);
      const engineSessions = courseSessions.map((session) => ({
        status: session.record?.status ?? "unmarked",
        lifecycle: session.event.status,
        scheduledMinutes: eventMinutes(session.event.starts_at, session.event.ends_at),
        attendedMinutes: session.record?.attended_minutes ?? null,
      }));
      const future = courseSessions.filter(
        (session) => session.event.status === "scheduled" && new Date(session.event.starts_at).getTime() > now,
      );
      const mode = course.calculation_mode;
      const futureUnits =
        mode === "hours"
          ? future.reduce((sum, session) => sum + eventMinutes(session.event.starts_at, session.event.ends_at), 0)
          : future.length;
      const summary = summarize({
        sessions: engineSessions,
        targetPercent: course.attendance_target ?? defaultTarget,
        mode,
        futureUnits: future.length > 0 || courseSessions.length > 0 ? futureUnits : null,
      });
      return {
        courseId: course.id,
        target: course.attendance_target ?? defaultTarget,
        mode,
        present: summary.present,
        absent: summary.absent,
        excused: summary.excused,
        unmarked: summary.unmarked,
        cancelled: summary.cancelled,
        rescheduled: summary.rescheduled,
        conducted: summary.conducted,
        counted: summary.counted,
        percent: summary.percent,
        bunkAllowance: summary.bunkAllowance,
        recoveryClasses: summary.recoveryClasses,
        projectedBestPercent: summary.projectedBestPercent,
        projectedWorstPercent: summary.projectedWorstPercent,
        futureScheduled: future.length,
        risk: summary.risk,
        attendedUnits: summary.attendedUnits,
        countedUnits: summary.countedUnits,
        futureUnits: summary.futureUnits,
      };
    });
  }, [snapshot.courses, sessions, semester?.attendance_target, now]);

  const overall = useMemo(() => {
    if (!semester) return null;
    return summarize({
      sessions: sessions.map((session) => ({
        status: session.record?.status ?? "unmarked",
        lifecycle: session.event.status,
      })),
      targetPercent: semester.attendance_target,
    });
  }, [sessions, semester]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...snapshot,
      user,
      profile,
      semester,
      setActiveSemester,
      loading,
      error,
      lastSyncedAt,
      syncing,
      conflicts,
      pendingCount: pending.size,
      offlineView,
      unreadCount: snapshot.notifications.filter((item) => !item.read_at).length,
      effectiveRecords,
      sessions,
      stats,
      overall,
      refresh,
      markAttendance,
      syncNow,
      resolveConflict,
    }),
    [snapshot, user, profile, semester, setActiveSemester, loading, error, lastSyncedAt, syncing, conflicts, pending.size, offlineView, effectiveRecords, sessions, stats, overall, refresh, markAttendance, syncNow, resolveConflict],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
