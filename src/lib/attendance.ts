import crypto from 'crypto';

export interface AttendanceSummary {
  totalEligible: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  percentage: number;
  isLowAttendance: boolean;
}

const MIN_THRESHOLD = parseInt(process.env.MIN_ATTENDANCE_PERCENTAGE || '75', 10);
const QR_SECRET = process.env.QR_SECRET || 'qr-code-signing-secret-key-12345';

/**
 * Calculates attendance percentage safely.
 * Formula: (Present + Late) / Total Eligible * 100
 */
export function calculateAttendanceStats(records: Array<{ status: string }>): AttendanceSummary {
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  for (const r of records) {
    if (r.status === 'present') present++;
    else if (r.status === 'late') late++;
    else if (r.status === 'absent') absent++;
    else if (r.status === 'excused') excused++;
  }

  const totalEligible = present + late + absent;
  const percentage = totalEligible > 0 ? parseFloat((((present + late) / totalEligible) * 100).toFixed(1)) : 100;
  const isLowAttendance = percentage < MIN_THRESHOLD && totalEligible >= 3;

  return {
    totalEligible,
    present,
    late,
    absent,
    excused,
    percentage,
    isLowAttendance,
  };
}

/**
 * Checks if current time is within active attendance session window
 * Returns 'present', 'late', or null (closed)
 */
export function evaluateSessionStatus(
  startTime: string, // "09:00"
  endTime: string, // "09:15"
  lateAfter?: string | null, // "09:10"
  currentTime?: string
): 'present' | 'late' | 'closed' {
  const now = new Date();
  const currentHoursMinutes = currentTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (currentHoursMinutes > endTime) {
    return 'closed';
  }

  if (lateAfter && currentHoursMinutes >= lateAfter) {
    return 'late';
  }

  return 'present';
}

/**
 * Generate short-lived signed QR token for teacher attendance session
 */
export function generateQrToken(sessionId: string, validitySeconds = 30): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + validitySeconds * 1000);
  const expTime = expiresAt.getTime();
  
  const payload = `${sessionId}:${expTime}`;
  const hmac = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');

  return { token, expiresAt };
}

/**
 * Validate dynamic QR code token
 */
export function verifyQrToken(token: string, expectedSessionId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [sessionId, expStr, signature] = decoded.split(':');
    
    if (sessionId !== expectedSessionId) return false;
    
    const expTime = parseInt(expStr, 10);
    if (Date.now() > expTime) return false; // expired

    const payload = `${sessionId}:${expStr}`;
    const expectedHmac = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex');

    return signature === expectedHmac;
  } catch (err) {
    return false;
  }
}

/**
 * Compare two times "HH:MM"
 */
export function isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
  return currentTime >= startTime && currentTime <= endTime;
}
