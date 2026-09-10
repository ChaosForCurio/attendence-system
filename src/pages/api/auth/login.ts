import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { comparePassword, hashPassword, createSessionToken, createAuthCookieHeader } from '@/lib/auth';
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

    const { email: rawIdentifier, password } = result.data;
    const cleanIdentifier = rawIdentifier.trim();
    const lowerIdentifier = cleanIdentifier.toLowerCase();

    // Fetch user from DB by email or studentNumber (case-insensitive)
    let user: any = null;

    // 1. Check by email (case-insensitive)
    const emailMatch = await db
      .select()
      .from(schema.users)
      .where(sql`LOWER(${schema.users.email}) = LOWER(${cleanIdentifier})`)
      .limit(1);

    if (emailMatch[0]) {
      user = emailMatch[0];
    } else {
      // 2. Check by student ID / Roll Number (case-insensitive)
      const studentMatch = await db
        .select()
        .from(schema.students)
        .where(sql`LOWER(${schema.students.studentNumber}) = LOWER(${cleanIdentifier})`)
        .limit(1);

      if (studentMatch[0]) {
        const linkedUser = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, studentMatch[0].userId))
          .limit(1);

        if (linkedUser[0]) {
          user = linkedUser[0];
        }
      }
    }

    // Auto-bootstrap teacher@bhavyacomputerclasses.com as Admin credentials
    if (lowerIdentifier === 'teacher@bhavyacomputerclasses.com' && password === 'TeacherPass123!') {
      const passwordHash = await hashPassword('TeacherPass123!');
      if (!user) {
        const newAdmin = {
          id: 'usr_teacher1',
          name: 'Mr. Sharma (Admin)',
          email: 'teacher@bhavyacomputerclasses.com',
          passwordHash,
          role: 'admin',
          status: 'active',
        };
        await db.insert(schema.users).values(newAdmin).onConflictDoNothing();
        user = newAdmin;
      } else {
        await db
          .update(schema.users)
          .set({ role: 'admin', status: 'active', passwordHash })
          .where(eq(schema.users.id, user.id));
        user.role = 'admin';
        user.status = 'active';
        user.passwordHash = passwordHash;
      }
    }

    if (!user || user.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Invalid Student ID / Email or inactive account.' }),
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
