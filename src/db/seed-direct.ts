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

    // 2. Class
    await sql`
      INSERT INTO classes (id, name, year, section, academic_year, status)
      VALUES ('cls_bca2a', 'Batch 2026-A (Web & Python)', 1, 'A', '2026', 'active')
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
        ('std_rahul', 'usr_student1', 'BCC202601', 'cls_bca2a'),
        ('std_aman', 'usr_student2', 'BCC202602', 'cls_bca2a'),
        ('std_priya', 'usr_student3', 'BCC202603', 'cls_bca2a'),
        ('std_rohan', 'usr_student4', 'BCC202604', 'cls_bca2a')
      ON CONFLICT (student_number) DO NOTHING;
    `;

    // 4. Subjects
    await sql`
      INSERT INTO subjects (id, name, code, description, status)
      VALUES 
        ('sub_webdev', 'Web Development', 'BCC-WEB101', 'Full Stack Web Engineering (HTML/CSS/JS/Astro)', 'active'),
        ('sub_python', 'Python & Data Science', 'BCC-PY201', 'Python Programming, Pandas, Data Analysis', 'active'),
        ('sub_tally', 'Tally Prime & Accounting', 'BCC-TAL301', 'Tally Prime, GST Accounting & Payroll', 'active'),
        ('sub_adca', 'ADCA Fundamentals', 'BCC-ADC100', 'Advanced Diploma in Computer Applications', 'active')
      ON CONFLICT (code) DO NOTHING;
    `;

    // 5. Class Subjects
    await sql`
      INSERT INTO class_subjects (id, class_id, subject_id, teacher_id)
      VALUES 
        ('cs_webdev', 'cls_bca2a', 'sub_webdev', 'tch_sharma'),
        ('cs_python', 'cls_bca2a', 'sub_python', 'tch_sharma'),
        ('cs_tally', 'cls_bca2a', 'sub_tally', 'tch_sharma'),
        ('cs_adca', 'cls_bca2a', 'sub_adca', 'tch_sharma')
      ON CONFLICT (id) DO NOTHING;
    `;

    // 6. Schedules
    await sql`
      INSERT INTO schedules (id, class_subject_id, day_of_week, start_time, end_time, room, status)
      VALUES 
        ('sch_webdev_mon', 'cs_webdev', 1, '09:00', '10:00', 'Lab 1', 'active'),
        ('sch_python_mon', 'cs_python', 1, '10:00', '11:00', 'Lab 1', 'active'),
        ('sch_tally_mon', 'cs_tally', 1, '11:00', '12:00', 'Lab 2', 'active'),
        ('sch_adca_mon', 'cs_adca', 1, '12:00', '13:00', 'Lab 2', 'active')
      ON CONFLICT (id) DO NOTHING;
    `;

    // 7. Active Session for today
    const todayStr = new Date().toISOString().split('T')[0];
    await sql`
      INSERT INTO attendance_sessions (id, class_subject_id, schedule_id, date, start_time, end_time, late_after, status, verification_method, created_by)
      VALUES ('sess_webdev_today', 'cs_webdev', 'sch_webdev_mon', ${todayStr}, '09:00', '23:59', '09:10', 'active', 'button', 'usr_teacher1')
      ON CONFLICT (id) DO NOTHING;
    `;

    console.log('✅ Bhavya Computer Classes Database seeded successfully on Neon!');
  } catch (err) {
    console.error('Seed error:', err);
  }
}

directSeed();
