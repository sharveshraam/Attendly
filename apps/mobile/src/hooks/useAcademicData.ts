import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import { useOfflineQuery } from './useOfflineQuery';
import { useAuth } from './useAuth';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useSyncStore } from '@/store/useSyncStore';
import { listOps } from '@/database/outbox';
import { summarize, type EngineSession } from '@/lib/attendance/engine';
import {
  fetchAcademicDays,
  fetchAssignments,
  fetchCourses,
  fetchEvents,
  fetchSemesters,
  fetchTimetableRules,
} from '@/services/api';
import { fetchAttendance } from '@/services/api/attendance';
import type {
  AttendanceRecord,
  CalendarEvent,
  Course,
  CourseAttendanceStats,
  Semester,
  SessionWithAttendance,
} from '@/types/domain';
import type { AttendanceStatus } from '@/types/database';

export function useSemesters() {
  const { user } = useAuth();
  return useOfflineQuery<Semester[]>(
    QUERY_KEYS.semesters,
    () => fetchSemesters(user!.id),
    { enabled: Boolean(user) },
  );
}

export function useActiveSemester() {
  const query = useSemesters();
  const activeId = usePreferencesStore((s) => s.activeSemesterId);
  const setActive = usePreferencesStore((s) => s.setActiveSemester);
  const semesters = query.data ?? [];
  const active = semesters.find((s) => s.id === activeId) ?? semesters[0] ?? null;

  useEffect(() => {
    if (!activeId && semesters.length > 0 && semesters[0]) {
      setActive(semesters[0].id);
    }
  }, [activeId, semesters, setActive]);

  return { ...query, semesters, active, setActiveSemester: setActive };
}

export function useCourses(semesterId: string | null) {
  return useOfflineQuery<Course[]>(
    QUERY_KEYS.courses(semesterId ?? 'none'),
    () => fetchCourses(semesterId!),
    { enabled: Boolean(semesterId) },
  );
}

export function useEvents(semesterId: string | null) {
  return useOfflineQuery<CalendarEvent[]>(
    QUERY_KEYS.events(semesterId ?? 'none'),
    () => fetchEvents(semesterId!),
    { enabled: Boolean(semesterId) },
  );
}

export function useTimetableRules(semesterId: string | null) {
  return useOfflineQuery(
    QUERY_KEYS.rules(semesterId ?? 'none'),
    () => fetchTimetableRules(semesterId!),
    { enabled: Boolean(semesterId) },
  );
}

export function useAcademicDays(semesterId: string | null) {
  return useOfflineQuery(
    QUERY_KEYS.academicDays(semesterId ?? 'none'),
    () => fetchAcademicDays(semesterId!),
    { enabled: Boolean(semesterId) },
  );
}

export function useAssignments(semesterId: string | null) {
  return useOfflineQuery(
    QUERY_KEYS.assignments(semesterId ?? 'none'),
    () => fetchAssignments(semesterId!),
    { enabled: Boolean(semesterId) },
  );
}

function useAttendanceRecords(semesterId: string | null, eventIds: string[], userId: string | undefined) {
  return useOfflineQuery<AttendanceRecord[]>(
    QUERY_KEYS.attendance(semesterId ?? 'none'),
    () => fetchAttendance(userId!, eventIds),
    { enabled: Boolean(semesterId && userId && eventIds.length > 0) },
  );
}

function eventMinutes(event: CalendarEvent): number {
  return Math.max(
    0,
    Math.round((new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60_000),
  );
}

/**
 * Class sessions joined with the user's private marks, overlaid with pending
 * offline edits so stats reflect unsynced marks immediately. Pending sessions
 * are flagged so the UI can distinguish synchronized from unsynchronized data.
 */
export function useSessions(semesterId: string | null): {
  sessions: SessionWithAttendance[];
  isLoading: boolean;
  pendingEventIds: Set<string>;
} {
  const { user } = useAuth();
  const eventsQuery = useEvents(semesterId);
  const events = eventsQuery.data ?? [];
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const attendanceQuery = useAttendanceRecords(semesterId, eventIds, user?.id);
  const records = attendanceQuery.data ?? [];
  const pending = useSyncStore((s) => s.pending);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);

  const { sessions, pendingEventIds } = useMemo(() => {
    const recordByEvent = new Map(records.map((r) => [r.event_id, r]));
    // Overlay pending/failed attendance ops from the outbox.
    const pendingMarks = new Map<string, { status: AttendanceStatus; minutes: number | null }>();
    for (const op of listOps()) {
      if (op.kind !== 'attendance.upsert') continue;
      if (op.status === 'conflict') continue;
      const payload = op.payload as { event_id: string; status: AttendanceStatus; attended_minutes: number | null };
      pendingMarks.set(payload.event_id, { status: payload.status, minutes: payload.attended_minutes });
    }
    const pendingIds = new Set(pendingMarks.keys());

    const merged: SessionWithAttendance[] = events
      .filter((e) => e.kind === 'class')
      .map((event) => {
        const serverRecord = recordByEvent.get(event.id) ?? null;
        const pendingMark = pendingMarks.get(event.id);
        const record: AttendanceRecord | null = pendingMark
          ? {
              id: serverRecord?.id ?? `pending-${event.id}`,
              user_id: user?.id ?? '',
              event_id: event.id,
              status: pendingMark.status,
              attended_minutes: pendingMark.minutes,
              note: serverRecord?.note ?? null,
              marked_at: serverRecord?.marked_at ?? null,
            }
          : serverRecord;
        let effectiveStatus: SessionWithAttendance['effectiveStatus'];
        if (event.status === 'cancelled') effectiveStatus = 'cancelled';
        else if (event.status === 'rescheduled') effectiveStatus = 'rescheduled';
        else effectiveStatus = record?.status ?? 'unmarked';
        return { event, record, effectiveStatus, pendingSync: pendingIds.has(event.id) };
      });
    return { sessions: merged, pendingEventIds: pendingIds };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, records, user?.id, pending, lastSyncAt]);

  return { sessions, isLoading: eventsQuery.isLoading || attendanceQuery.isLoading, pendingEventIds };
}

function toEngineSession(session: SessionWithAttendance): EngineSession {
  return {
    status: session.record?.status ?? 'unmarked',
    lifecycle: session.event.status,
    scheduledMinutes: eventMinutes(session.event),
    attendedMinutes: session.record?.attended_minutes ?? null,
  };
}

/** Per-course attendance statistics computed by the deterministic engine. */
export function useCourseStats(semesterId: string | null): {
  stats: CourseAttendanceStats[];
  courses: Course[];
  isLoading: boolean;
} {
  const coursesQuery = useCourses(semesterId);
  const courses = coursesQuery.data ?? [];
  const { sessions, isLoading: sessionsLoading } = useSessions(semesterId);
  const semesterQuery = useActiveSemester();
  const defaultTarget = semesterQuery.active?.attendance_target ?? 75;
  const now = Date.now();

  const stats = useMemo<CourseAttendanceStats[]>(() => {
    return courses.map((course) => {
      const courseSessions = sessions.filter((s) => s.event.course_id === course.id);
      const engineSessions = courseSessions.map(toEngineSession);
      const future = courseSessions.filter(
        (s) => s.event.status === 'scheduled' && new Date(s.event.starts_at).getTime() > now,
      );
      const futureUnits =
        course.calculation_mode === 'hours'
          ? future.reduce((sum, s) => sum + eventMinutes(s.event), 0)
          : future.length;
      const target = course.attendance_target ?? defaultTarget;
      const summary = summarize({
        sessions: engineSessions,
        targetPercent: target,
        mode: course.calculation_mode,
        futureUnits: future.length > 0 || courseSessions.length > 0 ? futureUnits : null,
      });
      return {
        courseId: course.id,
        target,
        mode: course.calculation_mode,
        conducted: summary.conducted,
        attended: summary.present,
        missed: summary.absent,
        excused: summary.excused,
        unmarked: summary.unmarked,
        cancelled: summary.cancelled,
        rescheduled: summary.rescheduled,
        percent: summary.percent,
        bunkAllowance: summary.bunkAllowance,
        recoveryClasses: summary.recoveryClasses,
        projectedBestPercent: summary.projectedBestPercent,
        projectedWorstPercent: summary.projectedWorstPercent,
        futureScheduled: future.length,
        risk: summary.risk,
        attendedUnits: summary.attendedUnits,
        countedUnits: summary.countedUnits,
      };
    });
  }, [courses, sessions, defaultTarget, now]);

  return { stats, courses, isLoading: coursesQuery.isLoading || sessionsLoading };
}

export function useInvalidateSemester(semesterId: string | null) {
  const queryClient = useQueryClient();
  return () => {
    if (!semesterId) return;
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.events(semesterId) });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.attendance(semesterId) });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.courses(semesterId) });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assignments(semesterId) });
  };
}
