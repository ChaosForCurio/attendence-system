import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';

export const GET: APIRoute = async ({ request }) => {
  const { response } = requireRole(request, ['teacher', 'admin']);
  if (response) return response;

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('id');

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'Session ID parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const sessionRecs = await db
      .select()
      .from(schema.attendanceSessions)
      .where(eq(schema.attendanceSessions.id, sessionId))
      .limit(1);

    const currentSession = sessionRecs[0];
    if (!currentSession) {
      return new Response(
        JSON.stringify({ error: 'Session not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const csRecs = await db
      .select({
        classId: schema.classSubjects.classId,
        className: schema.classes.name,
        subjectName: schema.subjects.name,
        subjectCode: schema.subjects.code,
      })
      .from(schema.classSubjects)
      .innerJoin(schema.classes, eq(schema.classSubjects.classId, schema.classes.id))
      .innerJoin(schema.subjects, eq(schema.classSubjects.subjectId, schema.subjects.id))
      .where(eq(schema.classSubjects.id, currentSession.classSubjectId))
      .limit(1);

    const csDetail = csRecs[0];

    const enrolledStudents = await db
      .select({
        studentId: schema.students.id,
        studentNumber: schema.students.studentNumber,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .where(eq(schema.students.classId, csDetail.classId));

    const records = await db
      .select()
      .from(schema.attendanceRecords)
      .where(eq(schema.attendanceRecords.sessionId, sessionId));

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let excusedCount = 0;

    const studentList = enrolledStudents.map((st: any) => {
      const rec = records.find((r: any) => r.studentId === st.studentId);
      const status = rec ? rec.status : 'unmarked';
      
      if (status === 'present') presentCount++;
      else if (status === 'late') lateCount++;
      else if (status === 'absent') absentCount++;
      else if (status === 'excused') excusedCount++;

      return {
        ...st,
        recordId: rec ? rec.id : null,
        status,
        markedAt: rec ? rec.markedAt : null,
        method: rec ? rec.method : null,
      };
    });

    const totalStudents = enrolledStudents.length;
    const unmarkedCount = totalStudents - (presentCount + lateCount + absentCount + excusedCount);

    return new Response(
      JSON.stringify({
        session: {
          ...currentSession,
          className: csDetail.className,
          subjectName: csDetail.subjectName,
          subjectCode: csDetail.subjectCode,
        },
        stats: {
          totalStudents,
          presentCount,
          lateCount,
          absentCount,
          excusedCount,
          unmarkedCount,
        },
        students: studentList,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Session detail error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve live session details.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
