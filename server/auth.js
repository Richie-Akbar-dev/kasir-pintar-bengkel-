/**
 * Autentikasi & otorisasi sederhana.
 * Password di-hash dengan scrypt (bawaan Node) + salt acak -> tidak butuh
 * dependency native seperti bcrypt.
 */
import crypto from 'node:crypto';
import db from './db.js';

const SESSION_COOKIE = 'kpb_session';
const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.insert('sessions', { token, userId, expiresAt });
  return { token, expiresAt };
}

export function destroySession(token) {
  const session = db.findOne('sessions', (s) => s.token === token);
  if (session) db.remove('sessions', session.id);
}

/** Bersihkan sesi yang sudah kedaluwarsa. */
export function pruneSessions() {
  const now = Date.now();
  for (const s of db.all('sessions')) {
    if (new Date(s.expiresAt).getTime() < now) db.remove('sessions', s.id);
  }
}

export function userFromToken(token) {
  if (!token) return null;
  const session = db.findOne('sessions', (s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    db.remove('sessions', session.id);
    return null;
  }
  const user = db.byId('users', session.userId);
  if (!user || !user.active) return null;
  return publicUser(user);
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function readToken(req) {
  if (req.cookies?.[SESSION_COOKIE]) return req.cookies[SESSION_COOKIE];
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** Middleware: isi req.user bila token valid. Tidak memblokir. */
export function attachUser(req, _res, next) {
  req.user = userFromToken(readToken(req));
  next();
}

/** Middleware: wajib login. */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  next();
}

/**
 * Middleware role. Role yang di-support: `owner` (akses penuh) dan `kasir`
 * (transaksi saja; tidak melihat harga modal/laba & tidak bisa menghapus).
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
    if (req.user.role === 'owner') return next(); // owner bisa semua
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak untuk akun kasir.' });
    }
    next();
  };
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 864e5,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE);
}

export { SESSION_COOKIE };
