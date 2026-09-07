import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized cron trigger.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentHoursMinutes = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const activeSessions = await db
      .select()
      .from(schema.attendanceSessions)
      .where(
        and(
          eq(schema.attendanceSessions.date, todayStr),
          eq(schema.attendanceSessions.status, 'active')
        )
      );

    const expiredSessions = activeSessions.filter((s: any) => currentHoursMinutes >= s.endTime);

    let closedCount = 0;
    let autoAbsentCount = 0;

    for (const session of expiredSessions) {
      await db
        .update(schema.attendanceSessions)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(schema.attendanceSessions.id, session.id));

      closedCount++;

      const csRec = await db
        .select()
        .from(schema.classSubjects)
        .where(eq(schema.classSubjects.id, session.classSubjectId))
        .limit(1);

      if (csRec[0]) {
        const enrolledStudents = await db
          .select()
          .from(schema.students)
          .where(eq(schema.students.classId, csRec[0].classId));

        const existingRecords = await db
          .select()
          .from(schema.attendanceRecords)
          .where(eq(schema.attendanceRecords.sessionId, session.id));

        const markedStudentIds = new Set(existingRecords.map((r: any) => r.studentId));

        for (const st of enrolledStudents) {
          if (!markedStudentIds.has(st.id)) {
            const recordId = `rec_abs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            await db.insert(schema.attendanceRecords).values({
              id: recordId,
              sessionId: session.id,
              studentId: st.id,
              status: 'absent',
              method: 'manual',
              markedAt: new Date(),
            }).onConflictDoNothing();

            autoAbsentCount++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cron completed: Closed ${closedCount} expired sessions, marked ${autoAbsentCount} absent records.`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Cron close sessions error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to execute cron job.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
