import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler, badRequest, intNum, num, WO_STATUS_LABELS } from '../util.js';

const router = Router();
const STATUSES = Object.keys(WO_STATUS_LABELS);

function enrich(wo) {
  return {
    ...wo,
    statusLabel: WO_STATUS_LABELS[wo.status] || wo.status,
    transactionCode: wo.transactionId ? db.byId('transactions', wo.transactionId)?.code || '' : '',
  };
}

router.get(
  '/',
  requireAuth,
  asyncHandler((req, res) => {
    const { status = '', q = '' } = req.query;
    let rows = db.all('work_orders');
    if (status && status !== 'all') rows = rows.filter((w) => w.status === status);

    const needle = String(q).toLowerCase().trim();
    if (needle) {
      rows = rows.filter((w) =>
        [w.code, w.customerName, w.plateNumber, w.complaint]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      );
    }

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({
      data: rows.map(enrich),
      meta: {
        counts: STATUSES.reduce((acc, s) => {
          acc[s] = db.count('work_orders', (w) => w.status === s);
          return acc;
        }, {}),
      },
    });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler((req, res) => {
    const row = db.byId('work_orders', req.params.id);
    if (!row) return res.status(404).json({ error: 'Work order tidak ditemukan.' });
    res.json({ data: enrich(row) });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler((req, res) => {
    const b = req.body || {};
    if (!b.customerName?.trim()) return badRequest(res, 'Nama pelanggan wajib diisi.');
    if (!b.complaint?.trim()) return badRequest(res, 'Keluhan / permintaan wajib diisi.');

    const maxQueue = db.all('work_orders').reduce((a, w) => Math.max(a, num(w.queueNumber)), 0);
    const now = new Date();

    // Item opsional: daftar jasa/sparepart yang diperkirakan dibutuhkan
    const items = (Array.isArray(b.items) ? b.items : []).map((raw) => {
      const source =
        raw.type === 'service' ? db.byId('services', raw.refId) : db.byId('products', raw.refId);
      if (!source) return null;
      return {
        type: raw.type === 'service' ? 'service' : 'product',
        refId: source.id,
        code: source.code,
        name: source.name,
        qty: Math.max(1, intNum(raw.qty, 1)),
        unit: raw.type === 'service' ? 'Layanan' : source.unit || 'Pcs',
        price: raw.type === 'service' ? num(source.price) : num(source.sellPrice),
        costPrice: raw.type === 'service' ? 0 : num(source.costPrice),
        discount: 0,
      };
    }).filter(Boolean);

    const customer = b.customerId ? db.byId('customers', b.customerId) : null;
    const vehicle = b.vehicleId ? db.byId('vehicles', b.vehicleId) : null;
    const mechanic = b.mechanicId ? db.byId('mechanics', b.mechanicId) : null;

    res.status(201).json({
      data: enrich(
        db.insert('work_orders', {
          code: `SPK-${String(maxQueue + 1).padStart(4, '0')}`,
          queueNumber: maxQueue + 1,
          date: now.toISOString(),
          customerId: customer ? customer.id : null,
          customerName: customer ? customer.name : String(b.customerName).trim(),
          customerPhone: customer ? customer.phone : b.customerPhone?.trim() || '',
          vehicleId: vehicle ? vehicle.id : null,
          plateNumber: vehicle ? vehicle.plateNumber : b.plateNumber?.trim() || '',
          vehicleLabel: vehicle
            ? `${vehicle.brand} ${vehicle.model}`.trim()
            : b.vehicleLabel?.trim() || '',
          complaint: String(b.complaint).trim(),
          diagnosis: b.diagnosis?.trim() || '',
          mechanicId: mechanic ? mechanic.id : null,
          mechanicName: mechanic ? mechanic.name : b.mechanicName?.trim() || '',
          odometer: b.odometer ? intNum(b.odometer) : null,
          status: STATUSES.includes(b.status) ? b.status : 'menunggu',
          estimatedCost: intNum(b.estimatedCost),
          items,
          note: b.note?.trim() || '',
          transactionId: null,
        })
      ),
    });
  })
);

router.put(
  '/:id',
  requireAuth,
  asyncHandler((req, res) => {
    const row = db.byId('work_orders', req.params.id);
    if (!row) return res.status(404).json({ error: 'Work order tidak ditemukan.' });
    const b = req.body || {};
    const patch = {};

    for (const key of ['customerName', 'customerPhone', 'plateNumber', 'vehicleLabel', 'complaint', 'diagnosis', 'mechanicName', 'note']) {
      if (b[key] !== undefined) patch[key] = String(b[key]).trim();
    }
    for (const key of ['customerId', 'vehicleId', 'mechanicId']) {
      if (b[key] !== undefined) patch[key] = b[key] || null;
    }
    if (b.odometer !== undefined) patch.odometer = b.odometer ? intNum(b.odometer) : null;
    if (b.estimatedCost !== undefined) patch.estimatedCost = intNum(b.estimatedCost);
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return badRequest(res, 'Status tidak dikenal.');
      patch.status = b.status;
    }
    if (Array.isArray(b.items)) {
      patch.items = b.items
        .map((raw) => {
          const source =
            raw.type === 'service' ? db.byId('services', raw.refId) : db.byId('products', raw.refId);
          if (!source) return null;
          return {
            type: raw.type === 'service' ? 'service' : 'product',
            refId: source.id,
            code: source.code,
            name: source.name,
            qty: Math.max(1, intNum(raw.qty, 1)),
            unit: raw.type === 'service' ? 'Layanan' : source.unit || 'Pcs',
            price: raw.type === 'service' ? num(source.price) : num(source.sellPrice),
            costPrice: raw.type === 'service' ? 0 : num(source.costPrice),
            discount: 0,
          };
        })
        .filter(Boolean);
    }

    res.json({ data: enrich(db.update('work_orders', row.id, patch)) });
  })
);

router.post(
  '/:id/status',
  requireAuth,
  asyncHandler((req, res) => {
    const row = db.byId('work_orders', req.params.id);
    if (!row) return res.status(404).json({ error: 'Work order tidak ditemukan.' });
    const status = String(req.body?.status || '');
    if (!STATUSES.includes(status)) return badRequest(res, 'Status tidak dikenal.');
    res.json({ data: enrich(db.update('work_orders', row.id, { status })) });
  })
);

router.delete(
  '/:id',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const row = db.byId('work_orders', req.params.id);
    if (!row) return res.status(404).json({ error: 'Work order tidak ditemukan.' });
    if (row.transactionId) return badRequest(res, 'Work order sudah masuk transaksi, tidak bisa dihapus.');
    db.remove('work_orders', row.id);
    res.json({ ok: true });
  })
);

export default router;
