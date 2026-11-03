import { courseSchema, eventSchema, inviteCodeSchema, semesterSchema, signUpSchema } from '../validation';

describe('signUpSchema', () => {
  it('requires matching passwords and a valid email', () => {
    expect(signUpSchema.safeParse({ displayName: 'Asha', email: 'asha@college.edu', password: 'secret1', confirmPassword: 'secret1' }).success).toBe(true);
    expect(signUpSchema.safeParse({ displayName: 'Asha', email: 'bad', password: 'secret1', confirmPassword: 'secret1' }).success).toBe(false);
    expect(signUpSchema.safeParse({ displayName: 'Asha', email: 'asha@college.edu', password: 'secret1', confirmPassword: 'other' }).success).toBe(false);
  });
  it('enforces the backend minimum password length of 6', () => {
    expect(signUpSchema.safeParse({ displayName: 'Asha', email: 'a@b.co', password: '12345', confirmPassword: '12345' }).success).toBe(false);
  });
});

describe('semesterSchema', () => {
  it('rejects end dates before start dates', () => {
    const result = semesterSchema.safeParse({ name: 'Sem 5', startDate: '2026-08-01', endDate: '2026-07-01', attendanceTarget: 75, predictionMode: 'rolling' });
    expect(result.success).toBe(false);
  });
  it('accepts an empty optional end date', () => {
    const result = semesterSchema.safeParse({ name: 'Sem 5', startDate: '2026-08-01', endDate: '', attendanceTarget: 75, predictionMode: 'fixed' });
    expect(result.success).toBe(true);
  });
});

describe('courseSchema', () => {
  it('validates color and calculation mode', () => {
    expect(courseSchema.safeParse({ name: 'Maths', category: 'theory', calculationMode: 'class_count', color: '#8B7CFF' }).success).toBe(true);
    expect(courseSchema.safeParse({ name: 'Maths', category: 'theory', calculationMode: 'class_count', color: 'purple' }).success).toBe(false);
  });
});

describe('eventSchema', () => {
  it('requires end after start', () => {
    const result = eventSchema.safeParse({ title: 'Exam', kind: 'exam', startDate: '2026-11-10', startTime: '10:00', endDate: '2026-11-10', endTime: '09:00' });
    expect(result.success).toBe(false);
  });
});

describe('inviteCodeSchema', () => {
  it('accepts alphanumeric codes and rejects symbols', () => {
    expect(inviteCodeSchema.safeParse('A1B2C3D4E5').success).toBe(true);
    expect(inviteCodeSchema.safeParse('A1B2-C3').success).toBe(false);
  });
});
