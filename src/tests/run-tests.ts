import { hashPassword, comparePassword, createSessionToken, verifySessionToken } from '../lib/auth';
import { calculateAttendanceStats, evaluateSessionStatus, generateQrToken, verifyQrToken, generateNewAdminQrToken, checkQrTokenStatus } from '../lib/attendance';
import { markAttendanceSchema, createSessionSchema } from '../lib/validation';

async function runAllTests() {
  console.log('🧪 Running Student Attendance System Automated Verification Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ✕ FAILED: ${testName}`);
      failed++;
    }
  }

  // Test Group 1: Authentication & Security
  console.log('--- Test Group 1: Password Hashing & Cookie Sessions ---');
  const plainPass = 'StudentPass123!';
  const hashedPass = await hashPassword(plainPass);
  assert(hashedPass !== plainPass, 'Password hashing scrambles plaintext');
  assert(await comparePassword(plainPass, hashedPass), 'Password verify returns true for correct password');
  assert(!(await comparePassword('WrongPass', hashedPass)), 'Password verify returns false for wrong password');

  const token = createSessionToken({
    id: 'usr_student1',
    name: 'Rahul Kumar',
    email: 'student1@institution.edu',
    role: 'student',
    studentId: 'std_rahul',
    classId: 'cls_bca2a',
  });
  assert(typeof token === 'string' && token.includes('.'), 'Session token generated in standard format');
  const decoded = verifySessionToken(token);
  assert(decoded?.name === 'Rahul Kumar' && decoded?.role === 'student', 'Session token correctly decoded and verified');
  assert(verifySessionToken('invalid.token.string') === null, 'Invalid session token rejected');

  // Test Group 2: Attendance Percentage & Calculation Logic
  console.log('\n--- Test Group 2: Attendance Percentage & Alert Calculation ---');
  const sampleRecords = [
    { status: 'present' },
    { status: 'present' },
    { status: 'present' },
    { status: 'late' },
    { status: 'absent' },
  ];
  const stats = calculateAttendanceStats(sampleRecords);
  assert(stats.totalEligible === 5, 'Total eligible calculated correctly (5)');
  assert(stats.present === 3 && stats.late === 1 && stats.absent === 1, 'Status counts match (3 present, 1 late, 1 absent)');
  assert(stats.percentage === 80, 'Percentage formula calculates accurately: (3+1)/5 * 100 = 80%');
  assert(!stats.isLowAttendance, 'No low attendance warning when percentage (80%) >= 75%');

  const lowRecords = [
    { status: 'present' },
    { status: 'absent' },
    { status: 'absent' },
    { status: 'absent' },
  ];
  const lowStats = calculateAttendanceStats(lowRecords);
  assert(lowStats.percentage === 25, 'Low attendance percentage calculated accurately (25%)');
  assert(lowStats.isLowAttendance === true, 'Low attendance warning triggered when percentage < 75%');

  // Test Group 3: Session Window Evaluation Logic
  console.log('\n--- Test Group 3: Session Window & Status Evaluation ---');
  const closedStatus = evaluateSessionStatus('08:00', '08:15', '08:10', '08:20');
  assert(closedStatus === 'closed', 'Session evaluated as closed when current time is past end time');

  // Test Group 4: Dynamic QR Token Security & Token Invalidation
  console.log('\n--- Test Group 4: Dynamic QR Token Security & Token Invalidation ---');
  const qr = generateQrToken('sess_12345', 10);
  assert(typeof qr.token === 'string', 'QR token string generated');
  assert(verifyQrToken(qr.token, 'sess_12345') === true, 'Valid QR token verified successfully');
  assert(verifyQrToken(qr.token, 'sess_WRONG') === false, 'QR token rejected for wrong session ID');

  // Test Admin Dynamic QR Generation and Termination of Previous Tokens
  const firstQr = generateNewAdminQrToken('sess_test_invalidation', '#ATT-TEST-001');
  assert(firstQr.status === 'active', 'First QR code token is active');
  assert(checkQrTokenStatus(firstQr.token, 'sess_test_invalidation').status === 'active', 'First QR token check returns active');

  const secondQr = generateNewAdminQrToken('sess_test_invalidation', '#ATT-TEST-001');
  assert(secondQr.status === 'active', 'Second QR code token is active');
  assert(checkQrTokenStatus(firstQr.token, 'sess_test_invalidation').status === 'terminated', 'Previous (first) QR token state is TERMINATED');
  assert(checkQrTokenStatus(secondQr.token, 'sess_test_invalidation').status === 'active', 'New (second) QR token state is ACTIVE');

  // Test Group 5: Zod Schema Validation
  console.log('\n--- Test Group 5: Zod Input Validation Schemas ---');
  const validMark = markAttendanceSchema.safeParse({ sessionId: 'sess_123', method: 'button' });
  assert(validMark.success, 'Valid mark attendance input accepted');
  const invalidMark = markAttendanceSchema.safeParse({ sessionId: '' });
  assert(!invalidMark.success, 'Invalid mark attendance input rejected');

  const validSession = createSessionSchema.safeParse({
    classSubjectId: 'cs_webdev',
    date: '2026-09-07',
    startTime: '09:00',
    endTime: '10:00',
    verificationMethod: 'button',
  });
  assert(validSession.success, 'Valid session creation schema accepted');

  console.log(`\n==========================================`);
  console.log(`  Test Suite Finished: ${passed} Passed, ${failed} Failed.`);
  console.log(`==========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
