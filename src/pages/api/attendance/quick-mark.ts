import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';
import { checkQrTokenStatus } from '@/lib/attendance';

export const POST: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['student']);
  if (response) return response;

  try {
    const studentId = session.studentId;
    const classId = session.classId;

    if (!studentId || !classId) {
      return new Response(
        JSON.stringify({ error: 'Student class profile is incomplete.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check optional token validation if provided in request body or url
    let qrToken = '';
    try {
      const requestData = await request.clone().json();
      qrToken = requestData.qrToken || requestData.token || '';
    } catch (e) {}

    const url = new URL(request.url);
    if (!qrToken) {
      qrToken = url.searchParams.get('token') || url.searchParams.get('qrToken') || '';
    }

    if (qrToken) {
      const qrCheck = checkQrTokenStatus(qrToken);
      if (qrCheck.status === 'terminated') {
        return new Response(
          JSON.stringify({
            error: '❌ QR CODE TERMINATED: This QR code has been invalidated by the instructor. Please scan the newly generated QR code on screen.',
            status: 'terminated',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      } else if (qrCheck.status === 'invalid') {
        return new Response(
          JSON.stringify({
            error: 'Invalid QR verification token.',
            status: 'invalid',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get student details
    const studentRecs = await db
      .select({
        studentId: schema.students.id,
        studentNumber: schema.students.studentNumber,
        userName: schema.users.name,
        userEmail: schema.users.email,
        className: schema.classes.name,
      })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .innerJoin(schema.classes, eq(schema.students.classId, schema.classes.id))
      .where(eq(schema.students.id, studentId))
      .limit(1);

    const studentInfo = studentRecs[0];
    if (!studentInfo) {
      return new Response(
        JSON.stringify({ error: 'Student record not found in system.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Find class-subject mappings for this class
    const csList = await db
      .select()
      .from(schema.classSubjects)
      .where(eq(schema.classSubjects.classId, classId));

    let activeSession: any = null;

    if (csList.length > 0) {
      const csIds = csList.map((c: any) => c.id);
      // Search for an active session today for any of these classSubjects
      const sessions = await db
        .select()
        .from(schema.attendanceSessions)
        .where(
          and(
            eq(schema.attendanceSessions.date, todayStr),
            eq(schema.attendanceSessions.status, 'active')
          )
        );

      activeSession = sessions.find((s: any) => csIds.includes(s.classSubjectId));
    }

    // If no session exists for today, dynamically create an active classroom session for attendance
    if (!activeSession) {
      let targetClassSubjectId = csList[0]?.id;

      // If no class-subject exists at all, find or fallback to first teacher
      if (!targetClassSubjectId) {
        const firstTeacher = await db.select().from(schema.teachers).limit(1);
        const firstSub = await db.select().from(schema.subjects).limit(1);

        if (firstTeacher[0] && firstSub[0]) {
          const csId = `cs_${Date.now()}`;
          await db.insert(schema.classSubjects).values({
            id: csId,
            classId,
            subjectId: firstSub[0].id,
            teacherId: firstTeacher[0].id,
          });
          targetClassSubjectId = csId;
        }
      }

      if (targetClassSubjectId) {
        const newSessId = `sess_perm_${Date.now()}`;
        const newSession = {
          id: newSessId,
          classSubjectId: targetClassSubjectId,
          date: todayStr,
          startTime: '08:00',
          endTime: '20:00',
          lateAfter: '12:00',
          status: 'active',
          verificationMethod: 'qr',
          createdBy: session.id,
        };
        await db.insert(schema.attendanceSessions).values(newSession);
        activeSession = newSession;
      }
    }

    if (!activeSession) {
      return new Response(
        JSON.stringify({ error: 'No active attendance session found for your class today.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if student has already marked attendance for this session
    const existingRec = await db
      .select()
      .from(schema.attendanceRecords)
      .where(
        and(
          eq(schema.attendanceRecords.sessionId, activeSession.id),
          eq(schema.attendanceRecords.studentId, studentId)
        )
      )
      .limit(1);

    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const formattedDate = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    if (existingRec[0]) {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyMarked: true,
          message: 'Attendance already recorded for today!',
          attendanceDetails: {
            studentName: studentInfo.userName,
            studentNumber: studentInfo.studentNumber,
            course: studentInfo.className,
            date: formattedDate,
            time: new Date(existingRec[0].markedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            }),
            status: 'PRESENT ✓',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create new attendance record in Neon DB
    const recId = `rec_qr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRecord = {
      id: recId,
      sessionId: activeSession.id,
      studentId,
      status: 'present',
      method: 'qr',
      markedAt: now,
    };

    await db.insert(schema.attendanceRecords).values(newRecord);

    // Audit log entry
    await db.insert(schema.auditLogs).values({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: session.id,
      action: 'PERMANENT_QR_ATTENDANCE_MARKED',
      entityType: 'attendance_records',
      entityId: recId,
      details: `Student ${studentInfo.userName} (${studentInfo.studentNumber}) marked PRESENT via Permanent QR code`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        alreadyMarked: false,
        message: 'Attendance marked successfully!',
        attendanceDetails: {
          studentName: studentInfo.userName,
          studentNumber: studentInfo.studentNumber,
          course: studentInfo.className,
          date: formattedDate,
          time: formattedTime,
          status: 'PRESENT ✓',
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Quick mark error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to record attendance. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
