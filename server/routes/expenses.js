import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler, badRequest, intNum, num, ymd, toCsv } from '../util.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler((req, res) => {
    const { from, to } = req.query;
    let rows = db.all('expenses');
    if (from) {
      const start = new Date(`${from}T00:00:00.000`).getTime();
      rows = rows.filter((e) => new Date(e.date).getTime() >= start);
    }
    if (to) {
      const end = new Date(`${to}T23:59:59.999`).getTime();
      rows = rows.filter((e) => new Date(e.date).getTime() <= end);
    }
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({
      data: rows,
      meta: { total: rows.reduce((a, e) => a + num(e.amount), 0) },
    });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler((req, res) => {
    const b = req.body || {};
    if (!b.name?.trim()) return badRequest(res, 'Keterangan pengeluaran wajib diisi.');
    const amount = intNum(b.amount);
    if (amount <= 0) return badRequest(res, 'Jumlah harus lebih dari 0.');

    res.status(201).json({
      data: db.insert('expenses', {
        date: b.date ? new Date(b.date).toISOString() : new Date().toISOString(),
        name: String(b.name).trim(),
        category: b.category?.trim() || 'Lainnya',
        amount,
        note: b.note?.trim() || '',
        userId: req.user.id,
        userName: req.user.name,
      }),
    });
  })
);

router.put(
  '/:id',
  requireAuth,
  asyncHandler((req, res) => {
    const row = db.byId('expenses', req.params.id);
    if (!row) return res.status(404).json({ error: 'Pengeluaran tidak ditemukan.' });
    const b = req.body || {};
    const patch = {};
    for (const key of ['name', 'category', 'note']) {
      if (b[key] !== undefined) patch[key] = String(b[key]).trim();
    }
    if (b.amount !== undefined) patch.amount = intNum(b.amount);
    if (b.date !== undefined) patch.date = new Date(b.date).toISOString();
    res.json({ data: db.update('expenses', row.id, patch) });
  })
);

router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler((req, res) => {
    if (!db.byId('expenses', req.params.id))
      return res.status(404).json({ error: 'Pengeluaran tidak ditemukan.' });
    db.remove('expenses', req.params.id);
    res.json({ ok: true });
  })
);

router.get(
  '/export/csv',
  requireRole('owner'),
  asyncHandler((_req, res) => {
    const rows = [...db.all('expenses')].sort((a, b) => new Date(b.date) - new Date(a.date));
    const csv = toCsv(rows, [
      { label: 'Tanggal', value: (r) => new Date(r.date).toLocaleDateString('id-ID') },
      { label: 'Keterangan', value: (r) => r.name },
      { label: 'Kategori', value: (r) => r.category },
      { label: 'Jumlah', value: (r) => r.amount },
      { label: 'Dicatat oleh', value: (r) => r.userName || '' },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pengeluaran-${ymd(new Date())}.csv"`);
    res.send(csv);
  })
);

export default router;
