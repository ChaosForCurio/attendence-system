import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';
import { calculateAttendanceStats } from '@/lib/attendance';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['student']);
  if (response) return response;

  try {
    let studentId = session.studentId;
    let classId = session.classId;

    // Fallback lookup if studentId or classId were not in session cookie
    if (!studentId || !classId) {
      const studentRec = await db
        .select()
        .from(schema.students)
        .where(eq(schema.students.userId, session.id))
        .limit(1);

      if (studentRec[0]) {
        studentId = studentRec[0].id;
        classId = studentRec[0].classId;
      }
    }

    if (!studentId) {
      return new Response(
        JSON.stringify({ error: 'Student record not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let studentClass: any = null;
    if (classId) {
      const classRecords = await db
        .select()
        .from(schema.classes)
        .where(eq(schema.classes.id, classId))
        .limit(1);
      studentClass = classRecords[0];
    }

    const studentRecords = await db
      .select({
        id: schema.attendanceRecords.id,
        sessionId: schema.attendanceRecords.sessionId,
        status: schema.attendanceRecords.status,
        markedAt: schema.attendanceRecords.markedAt,
        method: schema.attendanceRecords.method,
      })
      .from(schema.attendanceRecords)
      .where(eq(schema.attendanceRecords.studentId, studentId));

    const stats = calculateAttendanceStats(studentRecords);

    let classSubs: any[] = [];
    if (classId) {
      classSubs = await db
        .select({
          classSubjectId: schema.classSubjects.id,
          subjectId: schema.subjects.id,
          subjectName: schema.subjects.name,
          subjectCode: schema.subjects.code,
          teacherName: schema.users.name,
        })
        .from(schema.classSubjects)
        .innerJoin(schema.subjects, eq(schema.classSubjects.subjectId, schema.subjects.id))
        .innerJoin(schema.teachers, eq(schema.classSubjects.teacherId, schema.teachers.id))
        .innerJoin(schema.users, eq(schema.teachers.userId, schema.users.id))
        .where(eq(schema.classSubjects.classId, classId));
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Find active sessions for the student's class subjects (or any active session created today)
    const activeSessions = await db
      .select({
        sessionId: schema.attendanceSessions.id,
        classSubjectId: schema.attendanceSessions.classSubjectId,
        date: schema.attendanceSessions.date,
        startTime: schema.attendanceSessions.startTime,
        endTime: schema.attendanceSessions.endTime,
        lateAfter: schema.attendanceSessions.lateAfter,
        verificationMethod: schema.attendanceSessions.verificationMethod,
        status: schema.attendanceSessions.status,
      })
      .from(schema.attendanceSessions)
      .where(
        eq(schema.attendanceSessions.status, 'active')
      );

    let currentSession: any = null;
    let isAlreadyMarked = false;
    let markedRecord: any = null;

    for (const sess of activeSessions) {
      // Check if this session is for today or permanent active
      const cs = classSubs.find((c: any) => c.classSubjectId === sess.classSubjectId);
      if (cs) {
        const rec = studentRecords.find((r: any) => r.sessionId === sess.sessionId);
        if (rec) {
          isAlreadyMarked = true;
          markedRecord = rec;
        }

        currentSession = {
          ...sess,
          subjectName: cs.subjectName,
          subjectCode: cs.subjectCode,
          teacherName: cs.teacherName,
          room: 'Lab 1',
          isAlreadyMarked,
          markedRecord,
        };
        break;
      }
    }

    const subjectStats: Record<string, { name: string; code: string; total: number; present: number; percentage: number }> = {};
    for (const cs of classSubs) {
      subjectStats[cs.subjectId] = {
        name: cs.subjectName,
        code: cs.subjectCode,
        total: 0,
        present: 0,
        percentage: 100,
      };
    }

    return new Response(
      JSON.stringify({
        student: {
          id: studentId,
          name: session.name,
          email: session.email,
          className: studentClass ? studentClass.name : 'Unassigned',
        },
        stats,
        currentSession,
        todaySchedules: [],
        subjectStats: Object.values(subjectStats),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Student dashboard error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve dashboard data.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
