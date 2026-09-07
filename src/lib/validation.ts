import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const markAttendanceSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  method: z.enum(['button', 'qr', 'manual']).default('button'),
  qrToken: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const createSessionSchema = z.object({
  classSubjectId: z.string().min(1, 'Class Subject mapping is required'),
  scheduleId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM'),
  lateAfter: z.string().regex(/^\d{2}:\d{2}$/, 'Late after must be HH:MM').optional(),
  verificationMethod: z.enum(['button', 'qr', 'gps']).default('button'),
});

export const overrideAttendanceSchema = z.object({
  recordId: z.string().optional(),
  sessionId: z.string().min(1, 'Session ID is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  reason: z.string().optional(),
});

export const createStudentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  studentNumber: z.string().min(2, 'Student number is required'),
  classId: z.string().min(1, 'Class ID is required'),
});

export const createTeacherSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createClassSchema = z.object({
  name: z.string().min(2, 'Class name is required'),
  year: z.number().min(1).max(5),
  section: z.string().min(1),
  academicYear: z.string().min(4),
});

export const createSubjectSchema = z.object({
  name: z.string().min(2, 'Subject name is required'),
  code: z.string().min(2, 'Subject code is required'),
  description: z.string().optional(),
});

export const createScheduleSchema = z.object({
  classSubjectId: z.string().min(1, 'Class subject is required'),
  dayOfWeek: z.number().min(1).max(7), // 1 = Mon, 7 = Sun
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().min(1),
});
