import { inQuietHours, planNotifications, type PlanInput } from '../planner';

const prefs = {
  daily_reminder: true,
  schedule_changes: true,
  attendance_warnings: true,
  assignment_reminders: true,
  reminder_time: '07:00',
};

function baseInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    now: new Date('2026-11-03T06:00:00'),
    events: [],
    assignments: [],
    prefs,
    classReminderMinutes: 15,
    quietHours: { start: '22:00', end: '07:00' },
    horizonDays: 3,
    ...overrides,
  };
}

describe('inQuietHours', () => {
  it('handles overnight windows', () => {
    const quiet = { start: '22:00', end: '07:00' };
    expect(inQuietHours(new Date('2026-11-03T23:30:00'), quiet)).toBe(true);
    expect(inQuietHours(new Date('2026-11-03T06:00:00'), quiet)).toBe(true);
    expect(inQuietHours(new Date('2026-11-03T12:00:00'), quiet)).toBe(false);
  });
  it('returns false when no quiet hours set', () => {
    expect(inQuietHours(new Date('2026-11-03T23:30:00'), null)).toBe(false);
  });
});

describe('planNotifications', () => {
  it('schedules a daily summary and class reminders', () => {
    const planned = planNotifications(baseInput({
      events: [
        { id: 'e1', title: 'Maths', starts_at: '2026-11-03T09:00:00', kind: 'class', status: 'scheduled' },
        { id: 'e2', title: 'Physics', starts_at: '2026-11-03T14:00:00', kind: 'class', status: 'scheduled' },
      ],
    }));
    const daily = planned.filter((p) => p.category === 'daily_reminder');
    const classReminders = planned.filter((p) => p.category === 'class_reminder');
    expect(daily.length).toBeGreaterThan(0);
    expect(classReminders).toHaveLength(2);
    // 09:00 class reminded at 08:45 (outside quiet hours).
    expect(classReminders[0]?.date.getHours()).toBe(8);
    expect(classReminders[0]?.date.getMinutes()).toBe(45);
  });

  it('skips cancelled classes and quiet-hour reminders', () => {
    const planned = planNotifications(baseInput({
      events: [
        { id: 'e1', title: 'Cancelled', starts_at: '2026-11-03T09:00:00', kind: 'class', status: 'cancelled' },
        { id: 'e2', title: 'Early', starts_at: '2026-11-03T06:30:00', kind: 'class', status: 'scheduled' },
      ],
    }));
    expect(planned.filter((p) => p.category === 'class_reminder')).toHaveLength(0);
  });

  it('schedules assignment reminders a day before the deadline', () => {
    const planned = planNotifications(baseInput({
      assignments: [{ id: 'a1', title: 'Report', due_at: '2026-11-04T17:00:00', status: 'pending' }],
    }));
    const assignment = planned.find((p) => p.category === 'assignment');
    expect(assignment).toBeDefined();
    expect(assignment?.date.getDate()).toBe(3);
  });

  it('respects disabled preferences', () => {
    const planned = planNotifications(baseInput({
      prefs: { ...prefs, daily_reminder: false, assignment_reminders: false },
      assignments: [{ id: 'a1', title: 'Report', due_at: '2026-11-04T17:00:00', status: 'pending' }],
    }));
    expect(planned.filter((p) => p.category === 'daily_reminder')).toHaveLength(0);
    expect(planned.filter((p) => p.category === 'assignment')).toHaveLength(0);
  });
});
