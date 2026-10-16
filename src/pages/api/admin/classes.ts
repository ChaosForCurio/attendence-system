import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, sql, desc, inArray } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';
import { createClassSchema } from '@/lib/validation';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin', 'teacher']);
  if (response) return response;

  try {
    const list = await db
      .select({
        id: schema.classes.id,
        name: schema.classes.name,
        year: schema.classes.year,
        section: schema.classes.section,
        academicYear: schema.classes.academicYear,
        status: schema.classes.status,
        createdAt: schema.classes.createdAt,
        updatedAt: schema.classes.updatedAt,
        studentCount: sql<number>`count(${schema.students.id})::int`,
      })
      .from(schema.classes)
      .leftJoin(schema.students, eq(schema.classes.id, schema.students.classId))
      .groupBy(schema.classes.id)
      .orderBy(desc(schema.classes.createdAt));

    return new Response(JSON.stringify({ classes: list }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching classes:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve classes.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const body = await request.json();
    const result = createClassSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const classId = `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.insert(schema.classes).values({
      id: classId,
      ...result.data,
      status: 'active',
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Batch created successfully!' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating class:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create batch.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const body = await request.json();
    const { id, status, name, section, academicYear, year } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Batch ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return new Response(
          JSON.stringify({ error: 'Status must be active or inactive' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      updateData.status = status;
    }

    if (name !== undefined) updateData.name = name;
    if (section !== undefined) updateData.section = section;
    if (academicYear !== undefined) updateData.academicYear = academicYear;
    if (year !== undefined) updateData.year = Number(year);

    await db.update(schema.classes).set(updateData).where(eq(schema.classes.id, id));

    // When batch status is updated, cascade status to all students enrolled in this batch
    if (status !== undefined) {
      const batchStudents = await db
        .select({ userId: schema.students.userId })
        .from(schema.students)
        .where(eq(schema.students.classId, id));

      const userIds = batchStudents.map((s: { userId: string }) => s.userId).filter(Boolean);

      if (userIds.length > 0) {
        await db
          .update(schema.users)
          .set({ status: status, updatedAt: new Date() })
          .where(inArray(schema.users.id, userIds));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: status ? `Batch ${status === 'active' ? 'activated' : 'deactivated'} successfully!` : 'Batch updated successfully!',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error updating batch:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update batch.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Batch ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if students are enrolled in this batch
    const studentsInBatch = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.students)
      .where(eq(schema.students.classId, id));

    if (studentsInBatch[0]?.count > 0) {
      return new Response(
        JSON.stringify({
          error: `Cannot delete batch with ${studentsInBatch[0].count} enrolled student(s). Deactivate it instead to preserve attendance history.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await db.delete(schema.classes).where(eq(schema.classes.id, id));

    return new Response(
      JSON.stringify({ success: true, message: 'Batch deleted successfully!' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error deleting batch:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete batch.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

