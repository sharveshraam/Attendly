export const APP_NAME = 'Attendly';
export const APP_SCHEME = 'attendly';
export const AUTH_CALLBACK_PATH = 'auth/callback';
export const RESET_PASSWORD_PATH = 'auth/reset-password';

export const DEFAULT_ATTENDANCE_TARGET = 75;
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const STORAGE_KEYS = {
  theme: 'attendly.theme.preference',
  onboardingSkipped: 'attendly.onboarding.skipped',
  activeSemester: 'attendly.semester.active',
  notificationSettings: 'attendly.notifications.local',
  dashboardLayout: 'attendly.dashboard.layout',
  lastSyncAt: 'attendly.sync.lastAt',
} as const;

export const DOCUMENT_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  acceptedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'text/csv',
    'application/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
} as const;

export const QUERY_KEYS = {
  session: ['session'] as const,
  profile: ['profile'] as const,
  semesters: ['semesters'] as const,
  courses: (semesterId: string) => ['courses', semesterId] as const,
  events: (semesterId: string) => ['events', semesterId] as const,
  attendance: (semesterId: string) => ['attendance', semesterId] as const,
  rules: (semesterId: string) => ['rules', semesterId] as const,
  academicDays: (semesterId: string) => ['academicDays', semesterId] as const,
  assignments: (semesterId: string) => ['assignments', semesterId] as const,
  groups: ['groups'] as const,
  group: (groupId: string) => ['group', groupId] as const,
  notifications: ['notifications'] as const,
  notificationPreferences: ['notificationPreferences'] as const,
  documents: (semesterId: string) => ['documents', semesterId] as const,
  changeLog: (semesterId: string) => ['changeLog', semesterId] as const,
  polls: (groupId: string) => ['polls', groupId] as const,
};

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
