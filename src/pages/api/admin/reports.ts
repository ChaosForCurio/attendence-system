import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';

export const GET: APIRoute = async ({ request }) => {
  const { response } = requireRole(request, ['admin', 'teacher']);
  if (response) return response;

  try {
    // Join records with session, student, user, subject, class
    const reports = await db
      .select({
        recordId: schema.attendanceRecords.id,
        date: schema.attendanceSessions.date,
        studentName: schema.users.name,
        studentNumber: schema.students.studentNumber,
        className: schema.classes.name,
        subjectName: schema.subjects.name,
        status: schema.attendanceRecords.status,
        method: schema.attendanceRecords.method,
        markedAt: schema.attendanceRecords.markedAt,
      })
      .from(schema.attendanceRecords)
      .innerJoin(schema.attendanceSessions, eq(schema.attendanceRecords.sessionId, schema.attendanceSessions.id))
      .innerJoin(schema.students, eq(schema.attendanceRecords.studentId, schema.students.id))
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .innerJoin(schema.classSubjects, eq(schema.attendanceSessions.classSubjectId, schema.classSubjects.id))
      .innerJoin(schema.classes, eq(schema.classSubjects.classId, schema.classes.id))
      .innerJoin(schema.subjects, eq(schema.classSubjects.subjectId, schema.subjects.id));

    return new Response(JSON.stringify({ reports }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Reports endpoint error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate attendance report.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
