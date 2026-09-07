import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';
import { overrideAttendanceSchema } from '@/lib/validation';

export const POST: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['teacher', 'admin']);
  if (response) return response;

  try {
    const body = await request.json();
    const parseResult = overrideAttendanceSchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { sessionId, studentId, status, reason } = parseResult.data;

    // Check if record already exists
    const existing = await db
      .select()
      .from(schema.attendanceRecords)
      .where(
        and(
          eq(schema.attendanceRecords.sessionId, sessionId),
          eq(schema.attendanceRecords.studentId, studentId)
        )
      )
      .limit(1);

    const prevStatus = existing[0] ? existing[0].status : 'unmarked';

    if (existing[0]) {
      // Update existing record
      await db
        .update(schema.attendanceRecords)
        .set({
          status,
          method: 'manual',
          updatedAt: new Date(),
        })
        .where(eq(schema.attendanceRecords.id, existing[0].id));
    } else {
      // Insert new manual record
      const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.insert(schema.attendanceRecords).values({
        id: recordId,
        sessionId,
        studentId,
        status,
        method: 'manual',
        markedAt: new Date(),
      });
    }

    // Write audit log for teacher manual override
    await db.insert(schema.auditLogs).values({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: session.id,
      action: 'ATTENDANCE_OVERRIDE',
      entityType: 'attendance_records',
      entityId: `${sessionId}:${studentId}`,
      details: `Teacher ${session.name} changed status for student ${studentId} from ${prevStatus} to ${status}. Reason: ${reason || 'Manual override'}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Attendance status updated to ${status.toUpperCase()}`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Attendance override error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update attendance status.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
