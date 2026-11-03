/** Shared input validation. Every user-controlled value passes through here. */
import { z } from "zod";

export const emailSchema = z.string().trim().min(3).max(254).email("Enter a valid email address.");
/** Supabase auth is configured with a minimum password length of 6. */
export const passwordSchema = z.string().min(6, "Password must be at least 6 characters.").max(200);
export const displayNameSchema = z.string().trim().min(1).max(80);
export const shortText = (max = 120) => z.string().trim().min(1).max(max);
export const longText = (max = 5000) => z.string().trim().max(max);

export const loginSchema = z.object({ email: emailSchema, password: passwordSchema });
export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    displayName: displayNameSchema.optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const timeKey = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.");
const percent = z.coerce.number().min(0).max(100);

export const semesterSchema = z
  .object({
    name: shortText(100),
    institution: z.string().trim().max(160).optional().nullable(),
    start_date: dateKey,
    end_date: dateKey.optional().nullable(),
    attendance_target: percent,
    prediction_mode: z.enum(["fixed", "rolling"]),
  })
  .refine((value) => !value.end_date || value.end_date >= value.start_date, {
    message: "End date must be on or after the start date.",
    path: ["end_date"],
  });

export const courseSchema = z
  .object({
    name: shortText(120),
    code: z.string().trim().max(40).optional().nullable(),
    category: z.enum(["theory", "lab", "practical", "tutorial", "seminar", "exam"]),
    attendance_target: percent.optional().nullable(),
    calculation_mode: z.enum(["class_count", "hours"]),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour."),
  });

export const timetableRuleSchema = z
  .object({
    course_id: z.string().uuid(),
    weekday: z.coerce.number().int().min(0).max(6),
    starts_at: timeKey,
    ends_at: timeKey,
    location: z.string().trim().max(120).optional().nullable(),
    valid_from: dateKey.optional().nullable(),
    valid_until: dateKey.optional().nullable(),
  })
  .refine((value) => value.ends_at > value.starts_at, {
    message: "End time must be after start time.",
    path: ["ends_at"],
  });

export const eventSchema = z
  .object({
    title: shortText(160),
    kind: z.enum(["class", "exam", "holiday", "deadline", "other"]),
    course_id: z.string().uuid().optional().nullable(),
    starts_at: z.string().min(1, "Start time is required."),
    ends_at: z.string().min(1, "End time is required."),
    location: z.string().trim().max(160).optional().nullable(),
    description: longText(2000).optional().nullable(),
    status: z.enum(["scheduled", "cancelled", "rescheduled", "completed"]),
  })
  .refine((value) => new Date(value.ends_at).getTime() > new Date(value.starts_at).getTime(), {
    message: "End must be after start.",
    path: ["ends_at"],
  });

export const assignmentSchema = z.object({
  title: shortText(160),
  description: longText(2000).optional().nullable(),
  course_id: z.string().uuid().optional().nullable(),
  due_at: z.string().optional().nullable(),
  status: z.enum(["pending", "in_progress", "submitted"]),
});

export const groupSchema = z.object({ name: shortText(100) });
export const inviteSchema = z.string().trim().min(4).max(40).regex(/^[A-Za-z0-9-]+$/, "Invite codes are letters, numbers and dashes.");
export const profileSchema = z.object({
  display_name: z.string().trim().max(80),
  timezone: z.string().trim().max(64).min(1),
});

export const academicDaySchema = z.object({
  day: dateKey,
  kind: z.enum(["instructional", "non_instructional", "holiday", "exam", "closure", "special_working"]),
  title: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const notificationPreferencesSchema = z.object({
  daily_reminder: z.boolean(),
  schedule_changes: z.boolean(),
  attendance_warnings: z.boolean(),
  assignment_reminders: z.boolean(),
  reminder_time: timeKey,
  timezone: z.string().trim().min(1).max(64),
});

/** Accepted academic document uploads. MIME is checked but never trusted alone. */
export const ALLOWED_DOCUMENT_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "csv", "xlsx", "xls"] as const;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

export type UploadCheck = { ok: true; extension: string } | { ok: false; error: string };

export function validateUpload(file: { name: string; size: number; type: string }): UploadCheck {
  const extension = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension as (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number])) {
    return { ok: false, error: "Unsupported format. Use PDF, PNG, JPG, WEBP, CSV or Excel." };
  }
  if (file.size <= 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, error: "File is larger than 10 MB." };
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, error: "The file's declared type is not an accepted academic document." };
  }
  return { ok: true, extension };
}

export function safeParse<S extends z.ZodTypeAny>(schema: S, value: unknown):
  | { ok: true; data: z.infer<S> }
  | { ok: false; error: string } {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return { ok: false, error: first ? `${first.path.join(".") || "value"}: ${first.message}` : "Invalid input." };
}
