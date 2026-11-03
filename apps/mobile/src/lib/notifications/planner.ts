/**
 * Pure notification planning logic (no native I/O) so it is unit-testable.
 * Produces the set of local notifications to schedule given upcoming events,
 * assignments, preferences and quiet hours. The native service schedules these.
 */

export interface PlanEvent {
  id: string;
  title: string;
  starts_at: string;
  kind: 'class' | 'exam' | 'holiday' | 'deadline' | 'other';
  status: 'scheduled' | 'cancelled' | 'rescheduled' | 'completed';
}

export interface PlanAssignment {
  id: string;
  title: string;
  due_at: string | null;
  status: 'pending' | 'in_progress' | 'submitted';
}

export interface PlanPreferences {
  daily_reminder: boolean;
  schedule_changes: boolean;
  attendance_warnings: boolean;
  assignment_reminders: boolean;
  reminder_time: string; // HH:MM
}

export interface QuietHours {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface PlannedNotification {
  id: string;
  title: string;
  body: string;
  date: Date;
  category: string;
}

export interface PlanInput {
  now: Date;
  events: PlanEvent[];
  assignments: PlanAssignment[];
  prefs: PlanPreferences;
  classReminderMinutes: number;
  quietHours: QuietHours | null;
  horizonDays: number;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((p) => Number.parseInt(p, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

export function inQuietHours(date: Date, quiet: QuietHours | null): boolean {
  if (!quiet) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const start = timeToMinutes(quiet.start);
  const end = timeToMinutes(quiet.end);
  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  // Overnight window (e.g. 22:00 -> 07:00).
  return minutes >= start || minutes < end;
}

export function planNotifications(input: PlanInput): PlannedNotification[] {
  const { now, events, assignments, prefs, classReminderMinutes, quietHours, horizonDays } = input;
  const out: PlannedNotification[] = [];
  const horizonEnd = new Date(now.getTime() + horizonDays * 86_400_000);

  // Daily summary reminder.
  if (prefs.daily_reminder) {
    const [h, m] = prefs.reminder_time.split(':').map((p) => Number.parseInt(p, 10));
    for (let day = 0; day < horizonDays; day += 1) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      date.setHours(h ?? 7, m ?? 0, 0, 0);
      if (date <= now || date > horizonEnd) continue;
      if (inQuietHours(date, quietHours)) continue;
      const dayClasses = events.filter(
        (e) => e.kind === 'class' && e.status === 'scheduled' && isSameLocalDay(new Date(e.starts_at), date),
      );
      out.push({
        id: `daily-${date.toISOString().slice(0, 10)}`,
        title: 'Your day at a glance',
        body:
          dayClasses.length > 0
            ? `${dayClasses.length} class${dayClasses.length === 1 ? '' : 'es'} today. First: ${dayClasses[0]?.title ?? ''}.`
            : 'No classes scheduled today. A good day to catch up.',
        date,
        category: 'daily_reminder',
      });
    }
  }

  // Per-class and exam reminders.
  for (const event of events) {
    if (event.status !== 'scheduled') continue;
    const start = new Date(event.starts_at);
    if (start <= now || start > horizonEnd) continue;
    if (event.kind !== 'class' && event.kind !== 'exam') continue;
    const remindAt = new Date(start.getTime() - classReminderMinutes * 60_000);
    if (remindAt <= now) continue;
    if (inQuietHours(remindAt, quietHours)) continue;
    out.push({
      id: `${event.kind}-${event.id}`,
      title: event.kind === 'exam' ? `Exam soon: ${event.title}` : `Class soon: ${event.title}`,
      body: `Starts at ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`,
      date: remindAt,
      category: event.kind === 'exam' ? 'exam' : 'class_reminder',
    });
  }

  // Assignment deadline reminders (1 day before, at 09:00 local).
  if (prefs.assignment_reminders) {
    for (const assignment of assignments) {
      if (!assignment.due_at || assignment.status === 'submitted') continue;
      const due = new Date(assignment.due_at);
      if (due <= now || due > horizonEnd) continue;
      const remindAt = new Date(due.getTime() - 86_400_000);
      remindAt.setHours(9, 0, 0, 0);
      if (remindAt <= now) continue;
      if (inQuietHours(remindAt, quietHours)) continue;
      out.push({
        id: `assignment-${assignment.id}`,
        title: `Due tomorrow: ${assignment.title}`,
        body: 'Tap to review and mark it submitted.',
        date: remindAt,
        category: 'assignment',
      });
    }
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
