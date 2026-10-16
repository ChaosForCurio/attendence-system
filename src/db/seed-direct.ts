import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { neon } from '@neondatabase/serverless';
import { hashPassword } from '../lib/auth';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = 'postgresql://neondb_owner:npg_QmhFlg5TB0Sj@ep-autumn-paper-axv0bznd.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const sql = neon(connectionString);

async function directSeed() {
  console.log('🌱 Executing direct Neon Database Seed for Bhavya Computer Classes...');

  const adminPassword = await hashPassword('AdminPass123!');
  const teacherPassword = await hashPassword('TeacherPass123!');
  const studentPassword = await hashPassword('StudentPass123!');

  try {
    // Clean up legacy classes and subjects if present
    await sql`DELETE FROM attendance_records;`;
    await sql`DELETE FROM attendance_sessions;`;
    await sql`DELETE FROM schedules;`;
    await sql`DELETE FROM class_subjects;`;
    await sql`DELETE FROM students;`;
    await sql`DELETE FROM classes;`;
    await sql`DELETE FROM subjects;`;

    // 1. Users
    await sql`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES 
        ('usr_admin', 'Bhavya Admin', 'admin@bhavyacomputerclasses.com', ${adminPassword}, 'admin', 'active'),
        ('usr_teacher1', 'Mr. Sharma', 'teacher@bhavyacomputerclasses.com', ${teacherPassword}, 'admin', 'active'),
        ('usr_student1', 'Rahul Kumar', 'student1@bhavyacomputerclasses.com', ${studentPassword}, 'student', 'active'),
        ('usr_student2', 'Aman Sharma', 'student2@bhavyacomputerclasses.com', ${studentPassword}, 'student', 'active'),
        ('usr_student3', 'Priya Singh', 'student3@bhavyacomputerclasses.com', ${studentPassword}, 'student', 'active'),
        ('usr_student4', 'Rohan Gupta', 'student4@bhavyacomputerclasses.com', ${studentPassword}, 'student', 'active')
      ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, password_hash = EXCLUDED.password_hash, status = 'active';
    `;

    // 2. RSCIT Batches (Classes)
    await sql`
      INSERT INTO classes (id, name, year, section, academic_year, status)
      VALUES 
        ('cls_rscit_jan_a', 'RSCIT Jan 2026 (Batch A - Morning)', 1, 'A', '2026', 'active'),
        ('cls_rscit_jan_b', 'RSCIT Jan 2026 (Batch B - Evening)', 1, 'B', '2026', 'active'),
        ('cls_rscit_feb_a', 'RSCIT Feb 2026 (Batch A - Regular)', 1, 'A', '2026', 'active')
      ON CONFLICT (id) DO NOTHING;
    `;

    // 3. Teachers & Students
    await sql`
      INSERT INTO teachers (id, user_id)
      VALUES ('tch_sharma', 'usr_teacher1')
      ON CONFLICT (id) DO NOTHING;
    `;

    await sql`
      INSERT INTO students (id, user_id, student_number, class_id)
      VALUES 
        ('std_rahul', 'usr_student1', 'RSCIT202601', 'cls_rscit_jan_a'),
        ('std_aman', 'usr_student2', 'RSCIT202602', 'cls_rscit_jan_a'),
        ('std_priya', 'usr_student3', 'RSCIT202603', 'cls_rscit_jan_b'),
        ('std_rohan', 'usr_student4', 'RSCIT202604', 'cls_rscit_feb_a')
      ON CONFLICT (student_number) DO NOTHING;
    `;

    // 4. RSCIT Course (Subject)
    await sql`
      INSERT INTO subjects (id, name, code, description, status)
      VALUES 
        ('sub_rscit', 'RSCIT Computer Course', 'RSCIT-101', 'Rajasthan State Certificate in Information Technology', 'active')
      ON CONFLICT (code) DO NOTHING;
    `;

    // 5. Class Subjects Mapping
    await sql`
      INSERT INTO class_subjects (id, class_id, subject_id, teacher_id)
      VALUES 
        ('cs_rscit_jan_a', 'cls_rscit_jan_a', 'sub_rscit', 'tch_sharma'),
        ('cs_rscit_jan_b', 'cls_rscit_jan_b', 'sub_rscit', 'tch_sharma'),
        ('cs_rscit_feb_a', 'cls_rscit_feb_a', 'sub_rscit', 'tch_sharma')
      ON CONFLICT (id) DO NOTHING;
    `;

    // 6. Schedules for Monday
    await sql`
      INSERT INTO schedules (id, class_subject_id, day_of_week, start_time, end_time, room, status)
      VALUES 
        ('sch_rscit_jan_a_mon', 'cs_rscit_jan_a', 1, '09:00', '10:00', 'Lab 1', 'active'),
        ('sch_rscit_jan_b_mon', 'cs_rscit_jan_b', 1, '16:00', '17:00', 'Lab 1', 'active'),
        ('sch_rscit_feb_a_mon', 'cs_rscit_feb_a', 1, '11:00', '12:00', 'Lab 2', 'active')
      ON CONFLICT (id) DO NOTHING;
    `;

    // 7. Active Session for RSCIT Batch A today
    const todayStr = new Date().toISOString().split('T')[0];
    await sql`
      INSERT INTO attendance_sessions (id, class_subject_id, schedule_id, date, start_time, end_time, late_after, status, verification_method, created_by)
      VALUES ('sess_rscit_today', 'cs_rscit_jan_a', 'sch_rscit_jan_a_mon', ${todayStr}, '09:00', '23:59', '09:10', 'active', 'button', 'usr_teacher1')
      ON CONFLICT (id) DO NOTHING;
    `;

    console.log('✅ Bhavya Computer Classes Database seeded successfully with RSCIT Course and Batches on Neon!');
  } catch (err) {
    console.error('Seed error:', err);
  }
}

directSeed();
