import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';
import { markAttendanceSchema } from '@/lib/validation';
import { evaluateSessionStatus, verifyQrToken } from '@/lib/attendance';

export const POST: APIRoute = async ({ request }) => {
  // Rule 1 & 2: User authenticated and is a student
  const { session, response } = requireRole(request, ['student']);
  if (response) return response;

  try {
    const studentId = session.studentId;
    const classId = session.classId;

    if (!studentId || !classId) {
      return new Response(
        JSON.stringify({ error: 'Student profile configuration missing.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rule 3: Check student account status
    const studentRecs = await db.select().from(schema.students).where(eq(schema.students.id, studentId)).limit(1);
    if (!studentRecs[0]) {
      return new Response(
        JSON.stringify({ error: 'Student account not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const parseResult = markAttendanceSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { sessionId, method, qrToken } = parseResult.data;

    // Rule 4 & 5: Check session exists and is active
    const sessionRecs = await db
      .select()
      .from(schema.attendanceSessions)
      .where(eq(schema.attendanceSessions.id, sessionId))
      .limit(1);

    const currentSession = sessionRecs[0];
    if (!currentSession || currentSession.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Attendance session is not currently active or has been closed.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rule 6 & 7: Check student belongs to class & enrolled in subject
    const csRecs = await db
      .select()
      .from(schema.classSubjects)
      .where(eq(schema.classSubjects.id, currentSession.classSubjectId))
      .limit(1);

    const classSubject = csRecs[0];
    if (!classSubject || classSubject.classId !== classId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden. You are not enrolled in this class/subject session.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rule 8: Evaluate attendance time window & status (present vs late vs closed)
    const evaluatedStatus = evaluateSessionStatus(
      currentSession.startTime,
      currentSession.endTime,
      currentSession.lateAfter
    );

    if (evaluatedStatus === 'closed') {
      return new Response(
        JSON.stringify({ error: 'Attendance window for this class session has expired.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rule 10: QR Code Token Verification if required
    if (currentSession.verificationMethod === 'qr') {
      if (!qrToken || !verifyQrToken(qrToken, currentSession.id)) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired QR verification token.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Rule 9: Check duplicate submission
    const existingRecord = await db
      .select()
      .from(schema.attendanceRecords)
      .where(
        and(
          eq(schema.attendanceRecords.sessionId, sessionId),
          eq(schema.attendanceRecords.studentId, studentId)
        )
      )
      .limit(1);

    if (existingRecord[0]) {
      return new Response(
        JSON.stringify({
          alreadyMarked: true,
          message: 'Attendance already marked for this session.',
          record: existingRecord[0],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create attendance record
    const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRecord = {
      id: recordId,
      sessionId,
      studentId,
      status: evaluatedStatus, // 'present' or 'late'
      method,
      markedAt: new Date(),
    };

    await db.insert(schema.attendanceRecords).values(newRecord);

    // Write to audit log
    await db.insert(schema.auditLogs).values({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: session.id,
      action: 'ATTENDANCE_MARKED',
      entityType: 'attendance_records',
      entityId: recordId,
      details: `Student marked ${evaluatedStatus.toUpperCase()} for session ${sessionId} via ${method}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Attendance marked successfully as ${evaluatedStatus.toUpperCase()}!`,
        record: newRecord,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    // Catch duplicate constraint violations cleanly
    if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('UNIQUE')) {
      return new Response(
        JSON.stringify({ error: 'Attendance already recorded for this session.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('Mark attendance error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to record attendance due to a server error.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
