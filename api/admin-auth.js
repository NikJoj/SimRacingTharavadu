/**
 * API: Admin Authentication
 * Issues and validates short-lived tokens for the admin dashboard.
 *
 * POST /api/login-auth  { username, password }           — login, returns token
 * POST /api/login-auth  { action: "validate", token }    — validate existing token
 *
 * Token format: base64(JSON payload).HMAC-SHA256 signature
 * Expiry: 2 hours
 *
 * Environment variables required:
 *   ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET
 */

import { app } from '@azure/functions';
import crypto from 'crypto';

// Do not use an "admin*" route. Azure Functions reserves that route prefix
// for host-management endpoints after Static Web Apps forwards /api requests.
app.http('loginAuth', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'login-auth',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    try {
      const body = await request.json();
      const { username, password, action, token } = body;

      // ── validate token ─────────────────────────────────────────────────────
      if (action === 'validate') {
        if (!token) {
          return { status: 401, jsonBody: { error: 'No token provided' } };
        }
        try {
          const decoded = verifyToken(token);
          return { status: 200, jsonBody: { valid: true, username: decoded.username, expiresAt: decoded.exp } };
        } catch {
          return { status: 401, jsonBody: { error: 'Invalid or expired token' } };
        }
      }

      // ── login ──────────────────────────────────────────────────────────────
      if (!username || !password) {
        return { status: 400, jsonBody: { error: 'username and password are required' } };
      }

      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'srt2026admin';

      if (username === adminUsername && password === adminPassword) {
        return {
          status: 200,
          jsonBody: { success: true, token: generateToken(username), username, expiresIn: 7200 }
        };
      }

      return { status: 401, jsonBody: { error: 'Invalid credentials' } };

    } catch (error) {
      context.error('Auth error:', error);
      return { status: 500, jsonBody: { error: 'Authentication failed', message: error.message } };
    }
  }
});

function generateToken(username) {
  const secret = process.env.JWT_SECRET || 'srt-admin-secret-key-2026';
  const payload = { username, exp: Date.now() + (2 * 60 * 60 * 1000), iat: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64');
  // Use '|' as delimiter — safe because base64 never contains '|'
  return `${payloadB64}|${signature}`;
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'srt-admin-secret-key-2026';
  // Use last '|' as delimiter — base64 can contain '.' so we use a safe separator
  const idx = token.lastIndexOf('|');
  if (idx === -1) throw new Error('Invalid token format');
  const payloadB64 = token.slice(0, idx);
  const signature  = token.slice(idx + 1);
  if (!payloadB64 || !signature) throw new Error('Invalid token format');

  const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64');
  if (signature !== expected) throw new Error('Invalid signature');

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
  if (payload.exp < Date.now()) throw new Error('Token expired');
  return payload;
}
