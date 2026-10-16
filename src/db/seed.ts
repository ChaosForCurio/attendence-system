import { hashPassword } from '../lib/auth';
import { db } from './index';
import * as schema from './schema';

export async function runSeed() {
  console.log('🌱 Seeding Bhavya Career Institute Attendance System...');

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

    // 2. Create Classes / RSCIT Batches
    const classesData = [
      { id: 'cls_rscit_jan_a', name: 'RSCIT Jan 2026 (Batch A - Morning)', year: 1, section: 'A', academicYear: '2026', status: 'active' },
      { id: 'cls_rscit_jan_b', name: 'RSCIT Jan 2026 (Batch B - Evening)', year: 1, section: 'B', academicYear: '2026', status: 'active' },
      { id: 'cls_rscit_feb_a', name: 'RSCIT Feb 2026 (Batch A - Regular)', year: 1, section: 'A', academicYear: '2026', status: 'active' },
    ];
    for (const c of classesData) {
      await db.insert(schema.classes).values(c).onConflictDoNothing();
    }

    // 3. Create Teacher & Student profiles
    await db.insert(schema.teachers).values({ id: 'tch_sharma', userId: 'usr_teacher1' }).onConflictDoNothing();

    const studentsData = [
      { id: 'std_rahul', userId: 'usr_student1', studentNumber: 'RSCIT202601', classId: 'cls_rscit_jan_a' },
      { id: 'std_aman', userId: 'usr_student2', studentNumber: 'RSCIT202602', classId: 'cls_rscit_jan_a' },
      { id: 'std_priya', userId: 'usr_student3', studentNumber: 'RSCIT202603', classId: 'cls_rscit_jan_b' },
      { id: 'std_rohan', userId: 'usr_student4', studentNumber: 'RSCIT202604', classId: 'cls_rscit_feb_a' },
    ];

    for (const s of studentsData) {
      await db.insert(schema.students).values(s).onConflictDoNothing();
    }

    // 4. Create RSCIT Course / Subject
    const subjectsData = [
      { id: 'sub_rscit', name: 'RSCIT Computer Course', code: 'RSCIT-101', description: 'Rajasthan State Certificate in Information Technology', status: 'active' },
    ];

    for (const sub of subjectsData) {
      await db.insert(schema.subjects).values(sub).onConflictDoNothing();
    }

    // 5. Class Subjects Mapping
    const classSubjectsData = [
      { id: 'cs_rscit_jan_a', classId: 'cls_rscit_jan_a', subjectId: 'sub_rscit', teacherId: 'tch_sharma' },
      { id: 'cs_rscit_jan_b', classId: 'cls_rscit_jan_b', subjectId: 'sub_rscit', teacherId: 'tch_sharma' },
      { id: 'cs_rscit_feb_a', classId: 'cls_rscit_feb_a', subjectId: 'sub_rscit', teacherId: 'tch_sharma' },
    ];

    for (const cs of classSubjectsData) {
      await db.insert(schema.classSubjects).values(cs).onConflictDoNothing();
    }

    // 6. Schedules for Monday (dayOfWeek = 1)
    const schedulesData = [
      { id: 'sch_rscit_jan_a_mon', classSubjectId: 'cs_rscit_jan_a', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', room: 'Lab 1', status: 'active' },
      { id: 'sch_rscit_jan_b_mon', classSubjectId: 'cs_rscit_jan_b', dayOfWeek: 1, startTime: '16:00', endTime: '17:00', room: 'Lab 1', status: 'active' },
      { id: 'sch_rscit_feb_a_mon', classSubjectId: 'cs_rscit_feb_a', dayOfWeek: 1, startTime: '11:00', endTime: '12:00', room: 'Lab 2', status: 'active' },
    ];

    for (const sch of schedulesData) {
      await db.insert(schema.schedules).values(sch).onConflictDoNothing();
    }

    // 7. Active Attendance Session for RSCIT Batch A today
    const todayStr = new Date().toISOString().split('T')[0];
    const sessionData = {
      id: 'sess_rscit_today',
      classSubjectId: 'cs_rscit_jan_a',
      scheduleId: 'sch_rscit_jan_a_mon',
      date: todayStr,
      startTime: '09:00',
      endTime: '23:59',
      lateAfter: '09:10',
      status: 'active',
      verificationMethod: 'button',
      createdBy: 'usr_teacher1',
    };
    await db.insert(schema.attendanceSessions).values(sessionData).onConflictDoNothing();

    console.log('✅ Bhavya Career Institute Database seeded successfully with RSCIT Course!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

runSeed();
