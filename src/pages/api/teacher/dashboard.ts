import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['teacher']);
  if (response) return response;

  try {
    const teacherId = session.teacherId;
    if (!teacherId) {
      return new Response(
        JSON.stringify({ error: 'Teacher profile configuration missing.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const jsDay = new Date().getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const assignedClassSubjects = await db
      .select({
        classSubjectId: schema.classSubjects.id,
        classId: schema.classes.id,
        className: schema.classes.name,
        subjectId: schema.subjects.id,
        subjectName: schema.subjects.name,
        subjectCode: schema.subjects.code,
      })
      .from(schema.classSubjects)
      .innerJoin(schema.classes, eq(schema.classSubjects.classId, schema.classes.id))
      .innerJoin(schema.subjects, eq(schema.classSubjects.subjectId, schema.subjects.id))
      .where(eq(schema.classSubjects.teacherId, teacherId));

    const csIds = assignedClassSubjects.map((cs: any) => cs.classSubjectId);

    let todaySchedules: any[] = [];
    if (csIds.length > 0) {
      const schs = await db
        .select()
        .from(schema.schedules)
        .where(eq(schema.schedules.dayOfWeek, dayOfWeek));

      todaySchedules = schs.filter((s: any) => csIds.includes(s.classSubjectId)).map((sch: any) => {
        const cs = assignedClassSubjects.find((c: any) => c.classSubjectId === sch.classSubjectId);
        return {
          ...sch,
          className: cs?.className,
          subjectName: cs?.subjectName,
          subjectCode: cs?.subjectCode,
        };
      });
    }

    const sessionsToday = await db
      .select()
      .from(schema.attendanceSessions)
      .where(
        and(
          eq(schema.attendanceSessions.createdBy, session.id),
          eq(schema.attendanceSessions.date, todayStr)
        )
      );

    const activeSessionsWithDetails = sessionsToday.map((sess: any) => {
      const cs = assignedClassSubjects.find((c: any) => c.classSubjectId === sess.classSubjectId);
      return {
        ...sess,
        className: cs?.className || 'Class',
        subjectName: cs?.subjectName || 'Subject',
        subjectCode: cs?.subjectCode || '',
      };
    });

    return new Response(
      JSON.stringify({
        teacher: {
          id: teacherId,
          name: session.name,
          email: session.email,
        },
        assignedClassSubjects,
        todaySchedules,
        activeSessions: activeSessionsWithDetails,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Teacher dashboard error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve teacher dashboard data.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
