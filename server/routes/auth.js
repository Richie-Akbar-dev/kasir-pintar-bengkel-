import { Router } from 'express';
import db from '../db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  pruneSessions,
  publicUser,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
} from '../auth.js';
import { asyncHandler, badRequest } from '../util.js';

const router = Router();

router.post(
  '/login',
  asyncHandler((req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return badRequest(res, 'Username dan password wajib diisi.');

    const user = db.findOne(
      'users',
      (u) => u.username.toLowerCase() === String(username).toLowerCase()
    );
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Akun ini dinonaktifkan.' });
    }

    pruneSessions();
    const { token } = createSession(user.id);
    setSessionCookie(res, token);
    res.json({ user: publicUser(user), token });
  })
);

router.post(
  '/logout',
  asyncHandler((req, res) => {
    const token = req.cookies?.kpb_session || (req.headers.authorization || '').replace('Bearer ', '');
    if (token) destroySession(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  asyncHandler((req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Belum login.' });
    res.json({ user: req.user, settings: db.getSettings() });
  })
);

router.post(
  '/change-password',
  requireAuth,
  asyncHandler((req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return badRequest(res, 'Password lama dan baru wajib diisi.');
    if (String(newPassword).length < 4)
      return badRequest(res, 'Password baru minimal 4 karakter.');

    const user = db.byId('users', req.user.id);
    if (!verifyPassword(oldPassword, user.passwordHash))
      return res.status(400).json({ error: 'Password lama salah.' });

    db.update('users', user.id, { passwordHash: hashPassword(newPassword) });
    res.json({ ok: true });
  })
);

export default router;
