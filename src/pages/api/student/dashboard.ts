import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';
import { calculateAttendanceStats } from '@/lib/attendance';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['student']);
  if (response) return response;

  try {
    const studentId = session.studentId;
    const classId = session.classId;

    if (!studentId || !classId) {
      return new Response(
        JSON.stringify({ error: 'Student record configuration missing.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const jsDay = new Date().getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const classRecords = await db.select().from(schema.classes).where(eq(schema.classes.id, classId)).limit(1);
    const studentClass = classRecords[0];

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

    const classSubs = await db
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

    const classSubIds = classSubs.map((cs: any) => cs.classSubjectId);

    let schedulesList: any[] = [];
    if (classSubIds.length > 0) {
      schedulesList = await db
        .select({
          scheduleId: schema.schedules.id,
          classSubjectId: schema.schedules.classSubjectId,
          dayOfWeek: schema.schedules.dayOfWeek,
          startTime: schema.schedules.startTime,
          endTime: schema.schedules.endTime,
          room: schema.schedules.room,
        })
        .from(schema.schedules)
        .where(eq(schema.schedules.dayOfWeek, dayOfWeek));
    }

    const todaySchedules = schedulesList.map((sch: any) => {
      const cs = classSubs.find((c: any) => c.classSubjectId === sch.classSubjectId);
      return {
        ...sch,
        subjectName: cs ? cs.subjectName : 'Subject',
        subjectCode: cs ? cs.subjectCode : '',
        teacherName: cs ? cs.teacherName : 'Faculty',
      };
    }).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

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
        and(
          eq(schema.attendanceSessions.date, todayStr),
          eq(schema.attendanceSessions.status, 'active')
        )
      );

    let currentSession: any = null;
    let isAlreadyMarked = false;
    let markedRecord: any = null;

    for (const sess of activeSessions) {
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
          room: todaySchedules.find((s: any) => s.classSubjectId === sess.classSubjectId)?.room || 'Lab 1',
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
        todaySchedules,
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
