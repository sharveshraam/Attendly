import { answerQuestion, type AssistantData } from '../answers';
import type { CourseAttendanceStats } from '@/types/domain';

function stats(over: Partial<CourseAttendanceStats> = {}): CourseAttendanceStats {
  return {
    courseId: 'c1', target: 75, mode: 'class_count', conducted: 10, attended: 8, missed: 2, excused: 0,
    unmarked: 0, cancelled: 0, rescheduled: 0, percent: 80, bunkAllowance: 1, recoveryClasses: 0,
    projectedBestPercent: 90, projectedWorstPercent: 40, futureScheduled: 10, risk: 'safe',
    attendedUnits: 8, countedUnits: 10, ...over,
  };
}

const data: AssistantData = {
  semester: { id: 's1', owner_id: 'u1', group_id: null, name: 'Semester 5', institution: null, start_date: '2026-08-01', end_date: '2026-12-01', attendance_target: 75, prediction_mode: 'rolling', created_at: '' },
  courses: [{ id: 'c1', semester_id: 's1', code: 'CS201', name: 'Data Structures', category: 'theory', attendance_target: null, calculation_mode: 'class_count', color: '#8B7CFF', created_at: '' }],
  stats: [stats()],
  sessions: [],
  assignments: [],
  events: [],
};

describe('answerQuestion', () => {
  it('prompts setup when no semester exists', () => {
    const answer = answerQuestion('how is my attendance', { ...data, semester: null });
    expect(answer.text).toMatch(/set up a semester/i);
    expect(answer.action?.route).toBe('/onboarding');
  });

  it('reports overall attendance deterministically', () => {
    const answer = answerQuestion('How is my attendance?', {
      ...data,
      sessions: [
        { event: { id: 'e1', semester_id: 's1', group_id: null, course_id: 'c1', title: 'DS', kind: 'class', status: 'scheduled', starts_at: '2026-11-01T09:00:00Z', ends_at: '2026-11-01T10:00:00Z', location: null, description: null, source: 'manual', verification_status: 'confirmed', created_by: 'u1', updated_by: null, created_at: '', updated_at: '' }, record: { id: 'a1', user_id: 'u1', event_id: 'e1', status: 'present', attended_minutes: null, note: null, marked_at: '' }, effectiveStatus: 'present' },
      ],
    });
    expect(answer.text).toMatch(/100%/);
  });

  it('identifies at-risk courses', () => {
    const answer = answerQuestion('Which course is at risk?', { ...data, stats: [stats({ percent: 60, risk: 'at_risk', recoveryClasses: 5 })] });
    expect(answer.text).toMatch(/Data Structures/);
    expect(answer.text).toMatch(/60%/);
  });

  it('answers recovery questions', () => {
    const answer = answerQuestion('How many classes to recover?', { ...data, stats: [stats({ percent: 60, risk: 'at_risk', recoveryClasses: 5 })] });
    expect(answer.text).toMatch(/attend 5 more/i);
  });

  it('reports no upcoming classes gracefully', () => {
    const answer = answerQuestion('What is my next class?', data);
    expect(answer.text).toMatch(/no upcoming/i);
  });

  it('never throws on unknown questions and defaults to overall', () => {
    const answer = answerQuestion('tell me a joke', data);
    expect(answer.text.length).toBeGreaterThan(0);
  });
});
