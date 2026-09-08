import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  unique,
  index,
  boolean,
  varchar,
} from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 20 }).notNull().default('student'), // student, teacher, admin
    status: varchar('status', { length: 20 }).notNull().default('active'), // active, inactive
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_role').on(table.role),
  ]
);

// Classes table
export const classes = pgTable('classes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // e.g. "BCA 2A"
  year: integer('year').notNull().default(2),
  section: varchar('section', { length: 10 }).notNull().default('A'),
  academicYear: text('academic_year').notNull().default('2026-2027'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Students table
export const students = pgTable(
  'students',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studentNumber: text('student_number').notNull().unique(),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_students_user_id').on(table.userId),
    index('idx_students_class_id').on(table.classId),
  ]
);

// Teachers table
export const teachers = pgTable(
  'teachers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('idx_teachers_user_id').on(table.userId)]
);

// Subjects table
export const subjects = pgTable('subjects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // e.g. "Web Development"
  code: text('code').notNull().unique(), // e.g. "CS201"
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Class Subjects table (Junction: Class + Subject + Teacher)
export const classSubjects = pgTable('class_subjects', {
  id: text('id').primaryKey(),
  classId: text('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  subjectId: text('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  teacherId: text('teacher_id')
    .notNull()
    .references(() => teachers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Schedules table
export const schedules = pgTable(
  'schedules',
  {
    id: text('id').primaryKey(),
    classSubjectId: text('class_subject_id')
      .notNull()
      .references(() => classSubjects.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 1 = Monday, 7 = Sunday
    startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM, e.g. "09:00"
    endTime: varchar('end_time', { length: 5 }).notNull(), // HH:MM, e.g. "10:00"
    room: text('room').notNull().default('Room 101'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_schedules_class_subject').on(table.classSubjectId),
    index('idx_schedules_day_of_week').on(table.dayOfWeek),
  ]
);

// Attendance Sessions table
export const attendanceSessions = pgTable(
  'attendance_sessions',
  {
    id: text('id').primaryKey(),
    classSubjectId: text('class_subject_id')
      .notNull()
      .references(() => classSubjects.id, { onDelete: 'cascade' }),
    scheduleId: text('schedule_id').references(() => schedules.id, {
      onDelete: 'set null',
    }),
    date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
    startTime: varchar('start_time', { length: 5 }).notNull(), // "09:00"
    endTime: varchar('end_time', { length: 5 }).notNull(), // "09:15"
    lateAfter: varchar('late_after', { length: 5 }), // "09:10"
    status: varchar('status', { length: 20 }).notNull().default('active'), // scheduled, active, closed, cancelled
    verificationMethod: varchar('verification_method', { length: 20 })
      .notNull()
      .default('button'), // button, qr, manual
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_sessions_date').on(table.date),
    index('idx_sessions_class_subject').on(table.classSubjectId),
  ]
);

// Attendance Records table
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull(), // present, absent, late, excused
    method: varchar('method', { length: 20 }).notNull().default('button'), // button, qr, manual
    markedAt: timestamp('marked_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('unique_session_student').on(table.sessionId, table.studentId),
    index('idx_records_session_id').on(table.sessionId),
    index('idx_records_student_id').on(table.studentId),
  ]
);

// Dynamic QR & Verification metadata
export const attendanceVerifications = pgTable('attendance_verifications', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
  qrToken: text('qr_token').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active, terminated
  gpsLat: numeric('gps_lat'),
  gpsLng: numeric('gps_lng'),
  allowedRadiusMeters: integer('allowed_radius_meters').default(100),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Notifications
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Audit Logs table
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // e.g. "ATTENDANCE_OVERRIDE", "STUDENT_CREATED"
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
