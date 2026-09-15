import crypto from 'node:crypto';
import { SyncError } from './simgrid-client.js';

const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function secret() {
  const value = process.env.DRIVER_SESSION_SECRET || process.env.JWT_SECRET;
  if (!value || value.length < 24) throw new SyncError('Driver login is not configured.', 503);
  return value;
}

export function normalizeDiscordUsername(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

export function signDriverValue(payload, key = secret()) {
  const body = enc(payload);
  const signature = crypto.createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyDriverValue(value, purpose, key = secret()) {
  const [body, signature, extra] = String(value || '').split('.');
  if (!body || !signature || extra) throw new SyncError('Driver session is invalid.', 401);
  const expected = crypto.createHmac('sha256', key).update(body).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new SyncError('Driver session is invalid.', 401);
  }
  let payload; try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); }
  catch { throw new SyncError('Driver session is invalid.', 401); }
  if (payload.purpose !== purpose || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
    throw new SyncError('Driver session has expired.', 401);
  }
  return payload;
}

export function cookieValue(request, name) {
  const cookies = String(request.headers.get('cookie') || '').split(';');
  for (const item of cookies) {
    const separator = item.indexOf('=');
    if (separator > 0 && item.slice(0, separator).trim() === name) return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return '';
}

export function requireDriverSession(request) {
  return verifyDriverValue(cookieValue(request, 'srt_driver_session'), 'driver');
}

export function authCookie(name, value, maxAge) {
  return { name, value, path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge };
}

