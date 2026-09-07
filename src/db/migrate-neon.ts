import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const sql = neon(connectionString);

async function createTables() {
  console.log('⚡ Initializing Neon PostgreSQL Database Schema...');

  try {
    // 1. Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'student',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 2. Classes Table
    await sql`
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        year INTEGER NOT NULL DEFAULT 1,
        section VARCHAR(10) NOT NULL DEFAULT 'A',
        academic_year TEXT NOT NULL DEFAULT '2026',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 3. Students Table
    await sql`
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        student_number TEXT UNIQUE NOT NULL,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 4. Teachers Table
    await sql`
      CREATE TABLE IF NOT EXISTS teachers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 5. Subjects Table
    await sql`
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 6. Class Subjects Table
    await sql`
      CREATE TABLE IF NOT EXISTS class_subjects (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 7. Schedules Table
    await sql`
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        class_subject_id TEXT NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        room TEXT NOT NULL DEFAULT 'Lab 1',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 8. Attendance Sessions Table
    await sql`
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id TEXT PRIMARY KEY,
        class_subject_id TEXT NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
        schedule_id TEXT REFERENCES schedules(id) ON DELETE SET NULL,
        date VARCHAR(10) NOT NULL,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        late_after VARCHAR(5),
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        verification_method VARCHAR(20) NOT NULL DEFAULT 'button',
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 9. Attendance Records Table with UNIQUE(session_id, student_id)
    await sql`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        method VARCHAR(20) NOT NULL DEFAULT 'button',
        marked_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_session_student UNIQUE(session_id, student_id)
      );
    `;

    // 10. Audit Logs Table
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    console.log('✅ All tables successfully created on Neon PostgreSQL!');
  } catch (err) {
    console.error('Error creating Neon tables:', err);
  }
}

createTables();
