import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler, badRequest, num, requireFields } from '../util.js';

const router = Router();

function enrich(customer) {
  const vehicles = db.find('vehicles', (v) => v.customerId === customer.id);
  const trxs = db
    .find('transactions', (t) => t.customerId === customer.id && t.status === 'paid')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return {
    ...customer,
    vehicles,
    vehicleCount: vehicles.length,
    transactionCount: trxs.length,
    totalSpend: trxs.reduce((a, t) => a + num(t.total), 0),
    lastVisit: trxs[0]?.date || null,
  };
}

router.get(
  '/',
  requireAuth,
  asyncHandler((req, res) => {
    const needle = String(req.query.q || '').toLowerCase().trim();
    let rows = db.all('customers');
    if (needle) {
      rows = rows.filter((c) =>
        [c.name, c.phone, c.address].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
      );
    }
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'id'));
    res.json({ data: rows.map(enrich) });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler((req, res) => {
    const row = db.byId('customers', req.params.id);
    if (!row) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
    const full = enrich(row);
    full.history = db
      .find('transactions', (t) => t.customerId === row.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 50)
      .map((t) => ({
        id: t.id,
        code: t.code,
        date: t.date,
        total: t.total,
        status: t.status,
        paymentMethod: t.paymentMethod,
        plateNumber: t.plateNumber,
      }));
    res.json({ data: full });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler((req, res) => {
    const b = req.body || {};
    if (!b.name?.trim()) return badRequest(res, 'Nama pelanggan wajib diisi.');
    if (!b.phone?.trim()) return badRequest(res, 'Nomor HP wajib diisi.');

    const row = db.insert('customers', {
      name: String(b.name).trim(),
      phone: String(b.phone).trim(),
      address: b.address?.trim() || '',
      notes: b.notes?.trim() || '',
      active: true,
    });
    res.status(201).json({ data: enrich(row) });
  })
);

router.put(
  '/:id',
  requireAuth,
  asyncHandler((req, res) => {
    const row = db.byId('customers', req.params.id);
    if (!row) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
    const b = req.body || {};
    const patch = {};
    for (const key of ['name', 'phone', 'address', 'notes']) {
      if (b[key] !== undefined) patch[key] = String(b[key]).trim();
    }
    if (b.active !== undefined) patch.active = !!b.active;
    res.json({ data: enrich(db.update('customers', row.id, patch)) });
  })
);

router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const row = db.byId('customers', req.params.id);
    if (!row) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
    const used = db.findOne('transactions', (t) => t.customerId === row.id);
    if (used) return badRequest(res, 'Pelanggan sudah punya riwayat transaksi, tidak bisa dihapus.');
    for (const v of db.find('vehicles', (v) => v.customerId === row.id)) db.remove('vehicles', v.id);
    db.remove('customers', row.id);
    res.json({ ok: true });
  })
);

/* ------------------------------ Kendaraan ------------------------------ */

router.get(
  '/vehicles/all',
  requireAuth,
  asyncHandler((req, res) => {
    const needle = String(req.query.q || '').toLowerCase().trim();
    let rows = db.all('vehicles');
    if (needle) {
      rows = rows.filter((v) =>
        [v.plateNumber, v.brand, v.model].filter(Boolean).some((x) => String(x).toLowerCase().includes(needle))
      );
    }
    res.json({ data: rows });
  })
);

router.post(
  '/:id/vehicles',
  requireAuth,
  asyncHandler((req, res) => {
    const customer = db.byId('customers', req.params.id);
    if (!customer) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
    const b = req.body || {};
    const err = requireFields(b, ['plateNumber']);
    if (err) return badRequest(res, err);

    const plate = String(b.plateNumber).trim().toUpperCase();
    if (db.findOne('vehicles', (v) => v.plateNumber.toUpperCase() === plate))
      return badRequest(res, `Nomor polisi ${plate} sudah terdaftar.`);

    res.status(201).json({
      data: db.insert('vehicles', {
        customerId: customer.id,
        plateNumber: plate,
        brand: b.brand?.trim() || '',
        model: b.model?.trim() || '',
        year: b.year ? Number(b.year) : null,
        type: b.type?.trim() || 'Motor',
        notes: b.notes?.trim() || '',
      }),
    });
  })
);

router.put(
  '/vehicles/:vehicleId',
  requireAuth,
  asyncHandler((req, res) => {
    const row = db.byId('vehicles', req.params.vehicleId);
    if (!row) return res.status(404).json({ error: 'Kendaraan tidak ditemukan.' });
    const b = req.body || {};
    const patch = {};
    for (const key of ['brand', 'model', 'notes', 'type']) {
      if (b[key] !== undefined) patch[key] = String(b[key]).trim();
    }
    if (b.plateNumber !== undefined) {
      const plate = String(b.plateNumber).trim().toUpperCase();
      if (db.findOne('vehicles', (v) => v.plateNumber.toUpperCase() === plate && v.id !== row.id))
        return badRequest(res, `Nomor polisi ${plate} sudah terdaftar.`);
      patch.plateNumber = plate;
    }
    if (b.year !== undefined) patch.year = b.year ? Number(b.year) : null;
    res.json({ data: db.update('vehicles', row.id, patch) });
  })
);

router.delete(
  '/vehicles/:vehicleId',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const row = db.byId('vehicles', req.params.vehicleId);
    if (!row) return res.status(404).json({ error: 'Kendaraan tidak ditemukan.' });
    const used = db.findOne('transactions', (t) => t.vehicleId === row.id);
    if (used) return badRequest(res, 'Kendaraan sudah punya riwayat transaksi, tidak bisa dihapus.');
    db.remove('vehicles', row.id);
    res.json({ ok: true });
  })
);

export default router;
