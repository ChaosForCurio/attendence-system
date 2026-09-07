import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { comparePassword, createSessionToken, createAuthCookieHeader } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email, password } = result.data;

    // Fetch user from DB
    const userRecords = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    const user = userRecords[0];

    if (!user || user.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials or inactive account.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch extra role IDs
    let studentId: string | undefined;
    let teacherId: string | undefined;
    let classId: string | undefined;

    if (user.role === 'student') {
      const studentRec = await db.select().from(schema.students).where(eq(schema.students.userId, user.id)).limit(1);
      if (studentRec[0]) {
        studentId = studentRec[0].id;
        classId = studentRec[0].classId;
      }
    } else if (user.role === 'teacher') {
      const teacherRec = await db.select().from(schema.teachers).where(eq(schema.teachers.userId, user.id)).limit(1);
      if (teacherRec[0]) {
        teacherId = teacherRec[0].id;
      }
    }

    // Generate JWT-style signed cookie session
    const token = createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as any,
      studentId,
      teacherId,
      classId,
    });

    const cookieHeader = createAuthCookieHeader(token);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader,
        },
      }
    );
  } catch (error: any) {
    console.error('Login API error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected server error occurred.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
