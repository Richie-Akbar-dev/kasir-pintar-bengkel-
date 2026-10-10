import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import {
  asyncHandler,
  badRequest,
  intNum,
  num,
  ymd,
  toCsv,
  PAYMENT_LABELS,
} from '../util.js';

const router = Router();

/** Sembunyikan harga modal dari akun kasir. */
function present(trx, role) {
  if (role === 'owner') return trx;
  const items = (trx.items || []).map(({ costPrice, ...rest }) => rest);
  return { ...trx, items, subtotal: trx.subtotal, total: trx.total };
}

function nextTransactionCode(date = new Date()) {
  const dayKey = ymd(date).replace(/-/g, '');
  const prefix = `TRX-${dayKey}-`;
  const used = db
    .all('transactions')
    .map((t) => String(t.code || ''))
    .filter((c) => c.startsWith(prefix));
  let i = used.length + 1;
  let code = `${prefix}${String(i).padStart(3, '0')}`;
  while (used.includes(code)) {
    i += 1;
    code = `${prefix}${String(i).padStart(3, '0')}`;
  }
  return code;
}

/** Normalisasi & validasi item, sekalian hitung subtotal. */
function buildItems(rawItems, role) {
  if (!Array.isArray(rawItems) || rawItems.length === 0)
    throw Object.assign(new Error('Keranjang masih kosong.'), { status: 400 });

  const items = [];
  for (const raw of rawItems) {
    const refId = raw.refId || raw.id;
    const type = raw.type === 'service' ? 'service' : 'product';
    const source =
      type === 'product'
        ? db.byId('products', refId)
        : db.byId('services', refId);
    if (!source)
      throw Object.assign(
        new Error(`Item ${raw.name || refId} tidak ditemukan di katalog.`),
        { status: 400 }
      );

    const qty = Math.max(1, intNum(raw.qty, 1));
    if (type === 'product' && num(source.stock) < qty)
      throw Object.assign(
        new Error(`Stok "${source.name}" tidak mencukupi (tersisa ${num(source.stock)}).`),
        { status: 400 }
      );

    // Harga mengikuti katalog; override hanya boleh dilakukan owner.
    let price = intNum(raw.price, type === 'product' ? source.sellPrice : source.price);
    if (role !== 'owner' && price !== (type === 'product' ? source.sellPrice : source.price)) {
      price = type === 'product' ? source.sellPrice : source.price;
    }

    const discount = Math.max(0, intNum(raw.discount));
    items.push({
      type,
      refId: source.id,
      code: source.code,
      name: source.name,
      qty,
      unit: type === 'product' ? source.unit || 'Pcs' : 'Layanan',
      price,
      costPrice: type === 'product' ? num(source.costPrice) : 0,
      discount,
      mechanicId: raw.mechanicId || null,
      subtotal: price * qty - discount,
    });
  }
  return items;
}

/* ================================ LIST ================================ */

router.get(
  '/',
  requireAuth,
  asyncHandler((req, res) => {
    const { from, to, q = '', paymentMethod = '', status = 'paid', userId = '' } = req.query;
    const page = Math.max(1, intNum(req.query.page, 1));
    const limit = Math.min(200, Math.max(1, intNum(req.query.limit, 25)));

    let rows = db.all('transactions');

    if (from) {
      const start = new Date(`${from}T00:00:00.000`).getTime();
      rows = rows.filter((t) => new Date(t.date).getTime() >= start);
    }
    if (to) {
      const end = new Date(`${to}T23:59:59.999`).getTime();
      rows = rows.filter((t) => new Date(t.date).getTime() <= end);
    }
    if (paymentMethod) rows = rows.filter((t) => t.paymentMethod === paymentMethod);
    if (userId) rows = rows.filter((t) => t.userId === userId);
    if (status && status !== 'all') rows = rows.filter((t) => (t.status || 'paid') === status);

    const needle = String(q).toLowerCase().trim();
    if (needle) {
      rows = rows.filter((t) =>
        [t.code, t.customerName, t.plateNumber, t.note]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      );
    }

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalRows = rows.length;
    const totalOmzet = rows
      .filter((t) => t.status === 'paid')
      .reduce((a, t) => a + num(t.total), 0);
    const data = rows.slice((page - 1) * limit, page * limit).map((t) => present(t, req.user.role));

    res.json({
      data,
      meta: { page, limit, totalRows, totalPages: Math.max(1, Math.ceil(totalRows / limit)), totalOmzet },
    });
  })
);

/* =============================== DETAIL =============================== */

router.get(
  '/:id',
  requireAuth,
  asyncHandler((req, res) => {
    const row = db.byId('transactions', req.params.id);
    if (!row) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    res.json({ data: present(row, req.user.role), settings: db.getSettings() });
  })
);

/* =============================== CREATE =============================== */

router.post(
  '/',
  requireAuth,
  asyncHandler((req, res) => {
    const b = req.body || {};
    const items = buildItems(b.items, req.user.role);

    const paymentMethod = PAYMENT_LABELS[b.paymentMethod] ? b.paymentMethod : 'cash';
    const date = b.date ? new Date(b.date) : new Date();
    if (Number.isNaN(date.getTime())) return badRequest(res, 'Format tanggal tidak valid.');

    const subtotal = items.reduce((a, it) => a + it.price * it.qty, 0);
    const itemDiscount = items.reduce((a, it) => a + it.discount, 0);
    const extraDiscount = Math.max(0, intNum(b.discountAmount));

    const settings = db.getSettings();
    const taxEnabled = b.taxEnabled !== undefined ? !!b.taxEnabled : !!settings.taxEnabled;
    const taxPercent = num(
      b.taxPercent !== undefined ? b.taxPercent : settings.taxPercent,
      0
    );
    const taxable = Math.max(0, subtotal - itemDiscount - extraDiscount);
    const taxAmount = taxEnabled ? Math.round(taxable * (taxPercent / 100)) : 0;
    const total = Math.max(0, taxable + taxAmount);

    const customerId = b.customerId || null;
    const customer = customerId ? db.byId('customers', customerId) : null;
    const vehicleId = b.vehicleId || null;
    const vehicle = vehicleId ? db.byId('vehicles', vehicleId) : null;
    const mechanic = b.mechanicId ? db.byId('mechanics', b.mechanicId) : null;

    const isCredit = paymentMethod === 'credit';
    const paidAmount = isCredit ? 0 : Math.max(0, intNum(b.paidAmount, total));
    if (!isCredit && paidAmount < total)
      return badRequest(res, 'Jumlah bayar kurang dari total tagihan.');

    // --- Kurangi stok & catat pergerakan ---
    for (const it of items) {
      if (it.type !== 'product') continue;
      const product = db.byId('products', it.refId);
      db.update('products', product.id, { stock: num(product.stock) - it.qty });
      db.insert('stock_movements', {
        productId: product.id,
        productName: product.name,
        type: 'out',
        qty: it.qty,
        refType: 'transaction',
        refId: null, // diisi setelah transaksi dibuat
        note: 'Penjualan',
      });
    }

    const trx = db.insert('transactions', {
      code: nextTransactionCode(date),
      date: date.toISOString(),
      customerId,
      customerName: customer ? customer.name : b.customerName?.trim() || 'Pelanggan Umum',
      vehicleId,
      plateNumber: vehicle ? vehicle.plateNumber : b.plateNumber?.trim() || '',
      vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : '',
      items,
      subtotal,
      discountTotal: itemDiscount + extraDiscount,
      discountAmount: extraDiscount,
      taxEnabled,
      taxPercent,
      taxAmount,
      total,
      paymentMethod,
      creditSettled: !isCredit,
      paidAmount,
      changeAmount: isCredit ? 0 : Math.max(0, paidAmount - total),
      status: 'paid',
      note: b.note?.trim() || '',
      userId: req.user.id,
      userName: req.user.name,
      workOrderId: b.workOrderId || null,
      createdAt: date.toISOString(),
    });

    // Tautkan pergerakan stok ke transaksi ini
    for (const m of db.find('stock_movements', (m) => m.refType === 'transaction' && !m.refId)) {
      db.update('stock_movements', m.id, { refId: trx.id, refCode: trx.code });
    }

    // Jika berasal dari work order, tandai selesai & sudah diambil
    if (b.workOrderId) {
      const wo = db.byId('work_orders', b.workOrderId);
      if (wo) {
        db.update('work_orders', wo.id, {
          status: 'diambil',
          transactionId: trx.id,
          transactionCode: trx.code,
        });
      }
    }

    res.status(201).json({ data: present(trx, req.user.role), settings: db.getSettings() });
  })
);

/* ========================== BATALKAN (VOID) ========================== */

router.post(
  '/:id/void',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const row = db.byId('transactions', req.params.id);
    if (!row) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (row.status === 'void') return badRequest(res, 'Transaksi sudah dibatalkan sebelumnya.');

    // Kembalikan stok
    for (const it of row.items || []) {
      if (it.type !== 'product') continue;
      const product = db.byId('products', it.refId);
      if (!product) continue;
      db.update('products', product.id, { stock: num(product.stock) + num(it.qty) });
      db.insert('stock_movements', {
        productId: product.id,
        productName: product.name,
        type: 'in',
        qty: num(it.qty),
        refType: 'void',
        refId: row.id,
        refCode: row.code,
        note: `Retur / pembatalan ${row.code}`,
      });
    }

    const updated = db.update('transactions', row.id, {
      status: 'void',
      voidedAt: new Date().toISOString(),
      voidedBy: req.user.name,
      voidReason: req.body?.reason?.trim() || '',
    });
    res.json({ data: updated });
  })
);

/* ======================== PELUNASAN PIUTANG ======================== */

router.post(
  '/:id/settle',
  requireAuth,
  asyncHandler((req, res) => {
    const row = db.byId('transactions', req.params.id);
    if (!row) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (row.paymentMethod !== 'credit') return badRequest(res, 'Transaksi ini bukan kredit/bon.');
    const updated = db.update('transactions', row.id, {
      creditSettled: true,
      settledAt: new Date().toISOString(),
      settledBy: req.user.name,
      paidAmount: num(row.total),
    });
    res.json({ data: updated });
  })
);

/* ============================== EKSPOR CSV ============================== */

router.get(
  '/export/csv',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const { from, to } = req.query;
    let rows = db.find('transactions', (t) => t.status === 'paid');
    if (from) {
      const start = new Date(`${from}T00:00:00.000`).getTime();
      rows = rows.filter((t) => new Date(t.date).getTime() >= start);
    }
    if (to) {
      const end = new Date(`${to}T23:59:59.999`).getTime();
      rows = rows.filter((t) => new Date(t.date).getTime() <= end);
    }
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const csv = toCsv(rows, [
      { label: 'Kode', value: (r) => r.code },
      { label: 'Tanggal', value: (r) => new Date(r.date).toLocaleString('id-ID') },
      { label: 'Pelanggan', value: (r) => r.customerName },
      { label: 'Plat', value: (r) => r.plateNumber || '-' },
      { label: 'Item', value: (r) => (r.items || []).map((i) => `${i.name} x${i.qty}`).join('; ') },
      { label: 'Subtotal', value: (r) => r.subtotal },
      { label: 'Diskon', value: (r) => r.discountTotal },
      { label: 'Pajak', value: (r) => r.taxAmount },
      { label: 'Total', value: (r) => r.total },
      { label: 'Pembayaran', value: (r) => PAYMENT_LABELS[r.paymentMethod] || r.paymentMethod },
      { label: 'Kasir', value: (r) => r.userName || '' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transaksi-${ymd(new Date())}.csv"`
    );
    res.send(csv);
  })
);

export default router;
