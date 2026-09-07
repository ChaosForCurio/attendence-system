import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface UserSession {
  id: string; // User ID
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  studentId?: string;
  teacherId?: string;
  classId?: string;
  exp: number; // Unix epoch timestamp
}

const COOKIE_NAME = 'auth_token';
const SECRET = process.env.SESSION_SECRET || 'dev-super-secret-key-32-chars-minimum-length';

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

// Compare password with hash
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Create signed token
export function createSessionToken(session: Omit<UserSession, 'exp'>, expiresInHours = 24 * 7): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const payload: UserSession = { ...session, exp };
  const jsonPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(jsonPayload);
  const signature = hmac.digest('base64url');
  
  return `${jsonPayload}.${signature}`;
}

// Verify and decode token
export function verifySessionToken(token: string): UserSession | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [jsonPayload, signature] = token.split('.');
    
    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(jsonPayload);
    const expectedSignature = hmac.digest('base64url');

    if (signature !== expectedSignature) return null;

    const payload: UserSession = JSON.parse(Buffer.from(jsonPayload, 'base64url').toString('utf8'));
    
    // Check expiration
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

// Extract session from Astro API request cookies
export function getSessionFromRequest(request: Request): UserSession | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  return verifySessionToken(token);
}

// Parse raw Cookie header string
function parseCookies(header: string): Record<string, string> {
  const list: Record<string, string> = {};
  header.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    const value = parts.join('=').trim();
    if (name) list[name] = decodeURIComponent(value);
  });
  return list;
}

// Cookie header builder for response
export function createAuthCookieHeader(token: string, isProduction = process.env.NODE_ENV === 'production'): string {
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const sameSite = 'Lax';
  const secure = isProduction ? 'Secure;' : '';
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; ${secure} SameSite=${sameSite}`;
}

// Clear cookie header builder
export function createClearAuthCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}
