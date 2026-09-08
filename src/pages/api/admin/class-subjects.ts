import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';

export const GET: APIRoute = async ({ request }) => {
  const { response } = requireRole(request, ['admin', 'teacher']);
  if (response) return response;

  try {
    const list = await db
      .select({
        id: schema.classSubjects.id,
        classId: schema.classes.id,
        className: schema.classes.name,
        subjectId: schema.subjects.id,
        subjectName: schema.subjects.name,
        subjectCode: schema.subjects.code,
        teacherId: schema.teachers.id,
        teacherName: schema.users.name,
        teacherEmail: schema.users.email,
        createdAt: schema.classSubjects.createdAt,
      })
      .from(schema.classSubjects)
      .innerJoin(schema.classes, eq(schema.classSubjects.classId, schema.classes.id))
      .innerJoin(schema.subjects, eq(schema.classSubjects.subjectId, schema.subjects.id))
      .innerJoin(schema.teachers, eq(schema.classSubjects.teacherId, schema.teachers.id))
      .innerJoin(schema.users, eq(schema.teachers.userId, schema.users.id));

    return new Response(JSON.stringify({ classSubjects: list }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('List classSubjects error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve course assignments.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const body = await request.json();
    const { classId, subjectId, teacherId } = body;

    if (!classId || !subjectId || !teacherId) {
      return new Response(
        JSON.stringify({ error: 'classId, subjectId, and teacherId are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.insert(schema.classSubjects).values({
      id,
      classId,
      subjectId,
      teacherId,
    });

    // Audit log
    await db.insert(schema.auditLogs).values({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: session.id,
      action: 'COURSE_ASSIGNED',
      entityType: 'class_subjects',
      entityId: id,
      details: `Admin assigned subject ${subjectId} to class ${classId}`,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Course assigned successfully!' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Assign course error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to assign course.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
