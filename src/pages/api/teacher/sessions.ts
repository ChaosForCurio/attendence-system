import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';
import { createSessionSchema } from '@/lib/validation';

export const POST: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['teacher', 'admin']);
  if (response) return response;

  try {
    const body = await request.json();
    const result = createSessionSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { classSubjectId, scheduleId, date, startTime, endTime, lateAfter, verificationMethod } = result.data;

    // Check if session already exists for this class-subject & date
    const existing = await db
      .select()
      .from(schema.attendanceSessions)
      .where(
        and(
          eq(schema.attendanceSessions.classSubjectId, classSubjectId),
          eq(schema.attendanceSessions.date, date),
          eq(schema.attendanceSessions.status, 'active')
        )
      )
      .limit(1);

    if (existing[0]) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'An active session is already running.',
          session: existing[0],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSession = {
      id: sessionId,
      classSubjectId,
      scheduleId: scheduleId || null,
      date,
      startTime,
      endTime,
      lateAfter: lateAfter || null,
      status: 'active',
      verificationMethod,
      createdBy: session.id,
    };

    await db.insert(schema.attendanceSessions).values(newSession);

    // Audit log
    await db.insert(schema.auditLogs).values({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: session.id,
      action: 'SESSION_STARTED',
      entityType: 'attendance_sessions',
      entityId: sessionId,
      details: `Teacher started attendance session for ${classSubjectId} on ${date}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Attendance session started successfully!',
        session: newSession,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Start session error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to start attendance session.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['teacher', 'admin']);
  if (response) return response;

  try {
    const { sessionId, action } = await request.json();
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const status = action === 'close' ? 'closed' : 'cancelled';

    await db
      .update(schema.attendanceSessions)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.attendanceSessions.id, sessionId));

    // Audit log
    await db.insert(schema.auditLogs).values({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: session.id,
      action: `SESSION_${status.toUpperCase()}`,
      entityType: 'attendance_sessions',
      entityId: sessionId,
      details: `Teacher updated session status to ${status}`,
    });

    return new Response(
      JSON.stringify({ success: true, message: `Session status set to ${status}.` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Close session error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update session status.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
