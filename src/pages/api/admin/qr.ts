import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/permissions';
import { generateNewAdminQrToken, getLatestSessionQrToken, checkQrTokenStatus } from '@/lib/attendance';
import QRCode from 'qrcode';

const SITE_URL = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';

/** Generate the scan URL that gets encoded inside the QR image */
function buildScanUrl(token: string): string {
  return `${SITE_URL}/scan?token=${encodeURIComponent(token)}`;
}

/** Render a QR code token as a base64 PNG data URL */
async function generateQrDataUrl(token: string): Promise<string> {
  const url = buildScanUrl(token);
  return await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 400,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const { response } = requireRole(request, ['admin', 'teacher']);
  if (response) return response;

  const url = new URL(request.url);
  // classId is the per-class session key (falls back to legacy default)
  const classId = url.searchParams.get('classId') || url.searchParams.get('sessionId') || 'sess_webdev_today';
  const sessionCode = url.searchParams.get('sessionCode') || '#ATT-2026-091';
  const checkToken = url.searchParams.get('checkToken');

  if (checkToken) {
    const statusResult = checkQrTokenStatus(checkToken, classId);
    return new Response(JSON.stringify(statusResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const qrInfo = getLatestSessionQrToken(classId, sessionCode);

  // Generate real QR image
  let qrDataUrl = '';
  try {
    qrDataUrl = await generateQrDataUrl(qrInfo.token);
  } catch (err) {
    console.error('QR generation error:', err);
  }

  return new Response(
    JSON.stringify({
      success: true,
      ...qrInfo,
      qrDataUrl,
      scanUrl: buildScanUrl(qrInfo.token),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export const POST: APIRoute = async ({ request }) => {
  const { response } = requireRole(request, ['admin', 'teacher']);
  if (response) return response;

  try {
    const body = await request.json().catch(() => ({}));
    // Accept classId (preferred) or legacy sessionId
    const classId = body.classId || body.sessionId || 'sess_webdev_today';
    const sessionCode = body.sessionCode || `#ATT-${classId.toUpperCase().substring(0, 8)}`;

    // Generates a new unique QR token and TERMINATES the previous QR token!
    const newQrInfo = generateNewAdminQrToken(classId, sessionCode);

    // Generate real scannable QR PNG
    let qrDataUrl = '';
    try {
      qrDataUrl = await generateQrDataUrl(newQrInfo.token);
    } catch (err) {
      console.error('QR image generation error:', err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'New unique QR token generated. Previous QR token has been TERMINATED.',
        ...newQrInfo,
        previousTokenTerminated: true,
        qrDataUrl,
        scanUrl: buildScanUrl(newQrInfo.token),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('QR generate error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate new QR code token.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
