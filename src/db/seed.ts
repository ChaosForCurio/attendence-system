import { hashPassword } from '../lib/auth';
import { db } from './index';
import * as schema from './schema';

export async function runSeed() {
  console.log('🌱 Seeding Bhavya Computer Classes Attendance System...');

  const adminPassword = await hashPassword('AdminPass123!');
  const teacherPassword = await hashPassword('TeacherPass123!');
  const studentPassword = await hashPassword('StudentPass123!');

  try {
    // 1. Create Users
    const usersData = [
      { id: 'usr_admin', name: 'Bhavya Admin', email: 'admin@bhavyacomputerclasses.com', passwordHash: adminPassword, role: 'admin', status: 'active' },
      { id: 'usr_teacher1', name: 'Mr. Sharma', email: 'teacher@bhavyacomputerclasses.com', passwordHash: teacherPassword, role: 'admin', status: 'active' },
      { id: 'usr_student1', name: 'Rahul Kumar', email: 'student1@bhavyacomputerclasses.com', passwordHash: studentPassword, role: 'student', status: 'active' },
      { id: 'usr_student2', name: 'Aman Sharma', email: 'student2@bhavyacomputerclasses.com', passwordHash: studentPassword, role: 'student', status: 'active' },
      { id: 'usr_student3', name: 'Priya Singh', email: 'student3@bhavyacomputerclasses.com', passwordHash: studentPassword, role: 'student', status: 'active' },
      { id: 'usr_student4', name: 'Rohan Gupta', email: 'student4@bhavyacomputerclasses.com', passwordHash: studentPassword, role: 'student', status: 'active' },
    ];

    for (const u of usersData) {
      await db.insert(schema.users).values(u).onConflictDoNothing();
    }

    // 2. Create Class / Batch
    const classData = { id: 'cls_bca2a', name: 'Batch 2026-A (Web & Python)', year: 1, section: 'A', academicYear: '2026', status: 'active' };
    await db.insert(schema.classes).values(classData).onConflictDoNothing();

    // 3. Create Teacher & Student profiles
    await db.insert(schema.teachers).values({ id: 'tch_sharma', userId: 'usr_teacher1' }).onConflictDoNothing();

    const studentsData = [
      { id: 'std_rahul', userId: 'usr_student1', studentNumber: 'BCC202601', classId: 'cls_bca2a' },
      { id: 'std_aman', userId: 'usr_student2', studentNumber: 'BCC202602', classId: 'cls_bca2a' },
      { id: 'std_priya', userId: 'usr_student3', studentNumber: 'BCC202603', classId: 'cls_bca2a' },
      { id: 'std_rohan', userId: 'usr_student4', studentNumber: 'BCC202604', classId: 'cls_bca2a' },
    ];

    for (const s of studentsData) {
      await db.insert(schema.students).values(s).onConflictDoNothing();
    }

    // 4. Create Courses / Subjects at Bhavya Computer Classes
    const subjectsData = [
      { id: 'sub_webdev', name: 'Web Development', code: 'BCC-WEB101', description: 'Full Stack Web Development (HTML/CSS/JS/Astro)', status: 'active' },
      { id: 'sub_python', name: 'Python & Data Science', code: 'BCC-PY201', description: 'Python Programming, Pandas, Data Analysis', status: 'active' },
      { id: 'sub_tally', name: 'Tally Prime & Accounting', code: 'BCC-TAL301', description: 'Tally Prime, GST Accounting & Payroll', status: 'active' },
      { id: 'sub_adca', name: 'ADCA Fundamentals', code: 'BCC-ADC100', description: 'Advanced Diploma in Computer Applications', status: 'active' },
    ];

    for (const sub of subjectsData) {
      await db.insert(schema.subjects).values(sub).onConflictDoNothing();
    }

    // 5. Class Subjects Mapping
    const classSubjectsData = [
      { id: 'cs_webdev', classId: 'cls_bca2a', subjectId: 'sub_webdev', teacherId: 'tch_sharma' },
      { id: 'cs_python', classId: 'cls_bca2a', subjectId: 'sub_python', teacherId: 'tch_sharma' },
      { id: 'cs_tally', classId: 'cls_bca2a', subjectId: 'sub_tally', teacherId: 'tch_sharma' },
      { id: 'cs_adca', classId: 'cls_bca2a', subjectId: 'sub_adca', teacherId: 'tch_sharma' },
    ];

    for (const cs of classSubjectsData) {
      await db.insert(schema.classSubjects).values(cs).onConflictDoNothing();
    }

    // 6. Schedules for Monday (dayOfWeek = 1)
    const schedulesData = [
      { id: 'sch_webdev_mon', classSubjectId: 'cs_webdev', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', room: 'Lab 1', status: 'active' },
      { id: 'sch_python_mon', classSubjectId: 'cs_python', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', room: 'Lab 1', status: 'active' },
      { id: 'sch_tally_mon', classSubjectId: 'cs_tally', dayOfWeek: 1, startTime: '11:00', endTime: '12:00', room: 'Lab 2', status: 'active' },
      { id: 'sch_adca_mon', classSubjectId: 'cs_adca', dayOfWeek: 1, startTime: '12:00', endTime: '13:00', room: 'Lab 2', status: 'active' },
    ];

    for (const sch of schedulesData) {
      await db.insert(schema.schedules).values(sch).onConflictDoNothing();
    }

    // 7. Active Attendance Session for Web Development today
    const todayStr = new Date().toISOString().split('T')[0];
    const sessionData = {
      id: 'sess_webdev_today',
      classSubjectId: 'cs_webdev',
      scheduleId: 'sch_webdev_mon',
      date: todayStr,
      startTime: '09:00',
      endTime: '11:59',
      lateAfter: '09:10',
      status: 'active',
      verificationMethod: 'button',
      createdBy: 'usr_teacher1',
    };
    await db.insert(schema.attendanceSessions).values(sessionData).onConflictDoNothing();

    console.log('✅ Bhavya Computer Classes Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

runSeed();
