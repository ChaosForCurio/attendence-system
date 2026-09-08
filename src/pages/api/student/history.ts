import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['student']);
  if (response) return response;

  try {
    const studentId = session.studentId;
    if (!studentId) {
      return new Response(
        JSON.stringify({ error: 'Student ID missing.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const records = await db
      .select({
        id: schema.attendanceRecords.id,
        date: schema.attendanceSessions.date,
        status: schema.attendanceRecords.status,
        method: schema.attendanceRecords.method,
        markedAt: schema.attendanceRecords.markedAt,
        subjectName: schema.subjects.name,
        teacherName: schema.users.name,
        className: schema.classes.name,
      })
      .from(schema.attendanceRecords)
      .innerJoin(schema.attendanceSessions, eq(schema.attendanceRecords.sessionId, schema.attendanceSessions.id))
      .innerJoin(schema.classSubjects, eq(schema.attendanceSessions.classSubjectId, schema.classSubjects.id))
      .innerJoin(schema.subjects, eq(schema.classSubjects.subjectId, schema.subjects.id))
      .innerJoin(schema.classes, eq(schema.classSubjects.classId, schema.classes.id))
      .innerJoin(schema.teachers, eq(schema.classSubjects.teacherId, schema.teachers.id))
      .innerJoin(schema.users, eq(schema.teachers.userId, schema.users.id))
      .where(eq(schema.attendanceRecords.studentId, studentId))
      .orderBy(desc(schema.attendanceRecords.markedAt));

    return new Response(
      JSON.stringify({ records }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Student history API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve attendance history.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
