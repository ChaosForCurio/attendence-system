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

export interface ActiveQrInfo {
  token: string;
  sessionId: string;
  sessionCode: string;
  generatedAt: Date;
  formattedTime: string;
  status: 'active' | 'terminated';
  expiresAt: Date;
}

// In-memory token state tracking for active and terminated session QR codes
const activeQrTokensMap = new Map<string, ActiveQrInfo>();
const terminatedQrTokensSet = new Set<string>();

/**
 * Format Date object to HH:MM AM/PM string
 */
export function formatTime12h(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Generate short-lived signed QR token for teacher/admin attendance session
 */
export function generateQrToken(sessionId: string, validitySeconds = 86400): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + validitySeconds * 1000);
  const expTime = expiresAt.getTime();
  const nonce = crypto.randomBytes(4).toString('hex');
  
  const payload = `${sessionId}:${expTime}:${nonce}`;
  const hmac = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');

  return { token, expiresAt };
}

/**
 * Generate a new unique QR token for an admin panel session.
 * Terminates the previous QR code token for this session immediately!
 */
export function generateNewAdminQrToken(
  sessionId = 'sess_webdev_today',
  sessionCode = '#ATT-2026-091'
): ActiveQrInfo {
  // 1. Terminate previous QR token if exists
  const currentActive = activeQrTokensMap.get(sessionId);
  if (currentActive) {
    currentActive.status = 'terminated';
    terminatedQrTokensSet.add(currentActive.token);
  }

  // 2. Generate new unique QR token
  const { token, expiresAt } = generateQrToken(sessionId, 86400);
  const now = new Date();
  const newQrInfo: ActiveQrInfo = {
    token,
    sessionId,
    sessionCode,
    generatedAt: now,
    formattedTime: formatTime12h(now),
    status: 'active',
    expiresAt,
  };

  // 3. Store new active QR token
  activeQrTokensMap.set(sessionId, newQrInfo);
  return newQrInfo;
}

/**
 * Get current active QR token for session, generating one if none exists
 */
export function getLatestSessionQrToken(
  sessionId = 'sess_webdev_today',
  sessionCode = '#ATT-2026-091'
): ActiveQrInfo {
  const existing = activeQrTokensMap.get(sessionId);
  if (existing && existing.status === 'active') {
    return existing;
  }
  return generateNewAdminQrToken(sessionId, sessionCode);
}

/**
 * Check state of QR token (active vs terminated vs invalid)
 */
export function checkQrTokenStatus(
  token: string,
  sessionId = 'sess_webdev_today'
): { status: 'active' | 'terminated' | 'invalid'; message: string; info?: ActiveQrInfo } {
  if (!token) {
    return { status: 'invalid', message: 'No QR token provided.' };
  }

  // 1. Explicitly terminated list check
  if (terminatedQrTokensSet.has(token)) {
    return {
      status: 'terminated',
      message: 'This QR code has been terminated. Please scan the newly generated QR code on the admin screen.',
    };
  }

  // 2. Active token match check
  const activeInfo = activeQrTokensMap.get(sessionId);
  if (activeInfo) {
    if (activeInfo.token === token && activeInfo.status === 'active') {
      return { status: 'active', message: 'QR Token Active', info: activeInfo };
    } else {
      // It's an old token superseded by a newer generated token!
      terminatedQrTokensSet.add(token);
      return {
        status: 'terminated',
        message: 'This QR code has been terminated. A new QR code was generated for this session.',
      };
    }
  }

  // 3. Fallback cryptographic verify
  if (verifyQrToken(token, sessionId)) {
    return { status: 'active', message: 'QR Token Valid & Active' };
  }

  return { status: 'invalid', message: 'Invalid or expired QR token.' };
}

/**
 * Validate dynamic QR code token signature & expiration
 */
export function verifyQrToken(token: string, expectedSessionId: string): boolean {
  try {
    if (terminatedQrTokensSet.has(token)) return false;

    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    
    if (parts.length < 3) return false;
    const [sessionId, expStr, nonce, signature] = parts.length === 4 
      ? parts 
      : [parts[0], parts[1], '', parts[2]];
    
    if (sessionId !== expectedSessionId) return false;
    
    const expTime = parseInt(expStr, 10);
    if (Date.now() > expTime) return false; // expired

    const payload = nonce ? `${sessionId}:${expStr}:${nonce}` : `${sessionId}:${expStr}`;
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

