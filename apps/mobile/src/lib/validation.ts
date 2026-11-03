import { z } from 'zod';

export const emailSchema = z.string().trim().email('Enter a valid email address');
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password is too long');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Enter your name').max(80),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'Enter your name').max(80),
  timezone: z.string().min(1),
});

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const timeKey = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:MM');

export const semesterSchema = z
  .object({
    name: z.string().trim().min(2, 'Name your semester').max(80),
    institution: z.string().trim().max(120).optional(),
    startDate: dateKey,
    endDate: dateKey.optional().or(z.literal('')),
    attendanceTarget: z.coerce.number().min(0).max(100),
    predictionMode: z.enum(['fixed', 'rolling']),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });

export const courseSchema = z.object({
  name: z.string().trim().min(1, 'Course name is required').max(120),
  code: z.string().trim().max(40).optional().or(z.literal('')),
  category: z.string().trim().min(1).max(40),
  attendanceTarget: z.coerce.number().min(0).max(100).optional(),
  calculationMode: z.enum(['class_count', 'hours']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid color'),
});

export const timetableRuleSchema = z
  .object({
    courseId: z.string().uuid(),
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: timeKey,
    endTime: timeKey,
    location: z.string().trim().max(120).optional().or(z.literal('')),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export const assignmentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  courseId: z.string().uuid().optional().or(z.literal('')),
  dueAt: z.string().optional().or(z.literal('')),
  status: z.enum(['pending', 'in_progress', 'submitted']),
});

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(160),
    kind: z.enum(['class', 'exam', 'holiday', 'deadline', 'other']),
    courseId: z.string().uuid().optional().or(z.literal('')),
    startDate: dateKey,
    startTime: timeKey,
    endDate: dateKey,
    endTime: timeKey,
    location: z.string().trim().max(120).optional().or(z.literal('')),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .refine((data) => `${data.endDate}T${data.endTime}` >= `${data.startDate}T${data.startTime}`, {
    message: 'End must be after start',
    path: ['endTime'],
  });

export const groupSchema = z.object({
  name: z.string().trim().min(2, 'Group name is required').max(80),
});

export const inviteCodeSchema = z
  .string()
  .trim()
  .min(6, 'Enter the invite code')
  .max(20)
  .regex(/^[A-Za-z0-9]+$/, 'Invite codes are letters and numbers only');

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SemesterInput = z.infer<typeof semesterSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
export type EventInput = z.infer<typeof eventSchema>;

/** Flatten Zod issues into a field -> message map for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
