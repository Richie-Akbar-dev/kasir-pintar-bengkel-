import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole, publicUser } from '../auth.js';
import {
  asyncHandler,
  badRequest,
  intNum,
  num,
  nextCode,
  requireFields,
} from '../util.js';

const router = Router();

/* ============================== SPAREPART ============================== */

router.get(
  '/products',
  requireAuth,
  asyncHandler((req, res) => {
    const { q = '', category = '', lowStock = '' } = req.query;
    const needle = String(q).toLowerCase().trim();

    let rows = db.all('products');
    if (needle) {
      rows = rows.filter((p) =>
        [p.name, p.code, p.barcode, p.category]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      );
    }
    if (category) rows = rows.filter((p) => p.category === category);
    if (lowStock === '1' || lowStock === 'true')
      rows = rows.filter((p) => num(p.stock) <= num(p.minStock));

    rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'id'));
    res.json({ data: rows.map(stripCostForKasir(req)) });
  })
);

router.get(
  '/products/:id',
  requireAuth,
  asyncHandler((req, res) => {
    const row = db.byId('products', req.params.id);
    if (!row) return res.status(404).json({ error: 'Sparepart tidak ditemukan.' });
    const out = stripCostForKasir(req)(row);
    out.movements = db
      .find('stock_movements', (m) => m.productId === row.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50);
    res.json({ data: out });
  })
);

router.post(
  '/products',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const b = req.body || {};
    const err = requireFields(b, ['name', 'sellPrice']);
    if (err) return badRequest(res, err);

    const code = b.code?.trim() || nextCode('products', 'SP');
    if (db.findOne('products', (p) => p.code === code))
      return badRequest(res, `Kode ${code} sudah dipakai.`);

    const row = db.insert('products', {
      code,
      name: String(b.name).trim(),
      category: b.category?.trim() || 'Lainnya',
      unit: b.unit?.trim() || 'Pcs',
      costPrice: intNum(b.costPrice),
      sellPrice: intNum(b.sellPrice),
      stock: intNum(b.stock),
      minStock: intNum(b.minStock, 0),
      barcode: b.barcode?.trim() || '',
      location: b.location?.trim() || '',
      supplier: b.supplier?.trim() || '',
      active: b.active === false ? false : true,
      notes: b.notes?.trim() || '',
    });
    // Catat stok awal bila ada
    if (row.stock > 0) {
      db.insert('stock_movements', {
        productId: row.id,
        productName: row.name,
        type: 'in',
        qty: row.stock,
        refType: 'initial',
        refId: null,
        note: 'Stok awal',
      });
    }
    res.status(201).json({ data: row });
  })
);

router.put(
  '/products/:id',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const row = db.byId('products', req.params.id);
    if (!row) return res.status(404).json({ error: 'Sparepart tidak ditemukan.' });
    const b = req.body || {};

    const patch = {};
    for (const key of ['name', 'category', 'unit', 'barcode', 'location', 'supplier', 'notes', 'code']) {
      if (b[key] !== undefined) patch[key] = String(b[key]).trim();
    }
    for (const key of ['costPrice', 'sellPrice', 'stock', 'minStock']) {
      if (b[key] !== undefined) patch[key] = intNum(b[key]);
    }
    if (b.active !== undefined) patch.active = !!b.active;

    if (patch.code && db.findOne('products', (p) => p.code === patch.code && p.id !== row.id))
      return badRequest(res, `Kode ${patch.code} sudah dipakai.`);

    res.json({ data: db.update('products', row.id, patch) });
  })
);

router.delete(
  '/products/:id',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const row = db.byId('products', req.params.id);
    if (!row) return res.status(404).json({ error: 'Sparepart tidak ditemukan.' });
    db.remove('products', row.id);
    res.json({ ok: true });
  })
);

/** Penyesuaian stok: { type: 'in' | 'out' | 'set', qty, note } */
router.post(
  '/products/:id/stock',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const row = db.byId('products', req.params.id);
    if (!row) return res.status(404).json({ error: 'Sparepart tidak ditemukan.' });
    const { type = 'in', note = '' } = req.body || {};
    const qty = intNum(req.body?.qty);
    if (qty <= 0) return badRequest(res, 'Jumlah harus lebih dari 0.');

    let nextStock = num(row.stock);
    let movementType = 'in';
    let movementQty = qty;

    if (type === 'in') {
      nextStock += qty;
      movementType = 'in';
    } else if (type === 'out') {
      if (qty > row.stock) return badRequest(res, 'Stok tidak mencukupi.');
      nextStock -= qty;
      movementType = 'out';
    } else if (type === 'set') {
      movementQty = Math.abs(nextStock - qty);
      movementType = qty >= nextStock ? 'in' : 'out';
      nextStock = qty;
    } else {
      return badRequest(res, 'Jenis penyesuaian tidak dikenal.');
    }

    const updated = db.update('products', row.id, { stock: nextStock });
    db.insert('stock_movements', {
      productId: row.id,
      productName: row.name,
      type: movementType,
      qty: movementQty,
      refType: 'adjustment',
      refId: null,
      note: note || (type === 'set' ? 'Stok opname' : 'Penyesuaian stok'),
    });
    res.json({ data: updated });
  })
);

/* ============================ JASA SERVIS ============================ */

router.get(
  '/services',
  requireAuth,
  asyncHandler((req, res) => {
    const { q = '', category = '' } = req.query;
    const needle = String(q).toLowerCase().trim();
    let rows = db.all('services');
    if (needle) {
      rows = rows.filter((s) =>
        [s.name, s.code, s.category].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
      );
    }
    if (category) rows = rows.filter((s) => s.category === category);
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'id'));
    res.json({ data: rows });
  })
);

router.post(
  '/services',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const b = req.body || {};
    const err = requireFields(b, ['name', 'price']);
    if (err) return badRequest(res, err);
    const code = b.code?.trim() || nextCode('services', 'JS');
    if (db.findOne('services', (s) => s.code === code))
      return badRequest(res, `Kode ${code} sudah dipakai.`);

    res.status(201).json({
      data: db.insert('services', {
        code,
        name: String(b.name).trim(),
        category: b.category?.trim() || 'Lainnya',
        price: intNum(b.price),
        durationMin: intNum(b.durationMin, 30),
        active: b.active === false ? false : true,
        notes: b.notes?.trim() || '',
      }),
    });
  })
);

router.put(
  '/services/:id',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const row = db.byId('services', req.params.id);
    if (!row) return res.status(404).json({ error: 'Jasa servis tidak ditemukan.' });
    const b = req.body || {};
    const patch = {};
    for (const key of ['name', 'category', 'notes', 'code']) {
      if (b[key] !== undefined) patch[key] = String(b[key]).trim();
    }
    for (const key of ['price', 'durationMin']) {
      if (b[key] !== undefined) patch[key] = intNum(b[key]);
    }
    if (b.active !== undefined) patch.active = !!b.active;
    res.json({ data: db.update('services', row.id, patch) });
  })
);

router.delete(
  '/services/:id',
  requireRole('owner'),
  asyncHandler((req, res) => {
    if (!db.byId('services', req.params.id))
      return res.status(404).json({ error: 'Jasa servis tidak ditemukan.' });
    db.remove('services', req.params.id);
    res.json({ ok: true });
  })
);

/* ========================== KATEGORI JASA ========================== */

router.get(
  '/service-categories',
  requireAuth,
  asyncHandler((_req, res) => {
    res.json({ data: db.all('service_categories').map((c) => c.name) });
  })
);

router.post(
  '/service-categories',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return badRequest(res, 'Nama kategori wajib diisi.');
    if (db.findOne('service_categories', (c) => c.name.toLowerCase() === name.toLowerCase()))
      return badRequest(res, 'Kategori sudah ada.');
    res.status(201).json({ data: db.insert('service_categories', { name }) });
  })
);

router.delete(
  '/service-categories/:name',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const name = decodeURIComponent(req.params.name);
    const row = db.findOne('service_categories', (c) => c.name === name);
    if (row) db.remove('service_categories', row.id);
    res.json({ ok: true });
  })
);

/* ============================== MEKANIK ============================== */

router.get(
  '/mechanics',
  requireAuth,
  asyncHandler((_req, res) => {
    res.json({
      data: db
        .all('mechanics')
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'id')),
    });
  })
);

router.post(
  '/mechanics',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const b = req.body || {};
    if (!b.name?.trim()) return badRequest(res, 'Nama mekanik wajib diisi.');
    res.status(201).json({
      data: db.insert('mechanics', {
        name: String(b.name).trim(),
        phone: b.phone?.trim() || '',
        sharePercent: num(b.sharePercent, 0),
        active: b.active === false ? false : true,
        notes: b.notes?.trim() || '',
      }),
    });
  })
);

router.put(
  '/mechanics/:id',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const row = db.byId('mechanics', req.params.id);
    if (!row) return res.status(404).json({ error: 'Mekanik tidak ditemukan.' });
    const b = req.body || {};
    const patch = {};
    for (const key of ['name', 'phone', 'notes']) {
      if (b[key] !== undefined) patch[key] = String(b[key]).trim();
    }
    if (b.sharePercent !== undefined) patch.sharePercent = num(b.sharePercent);
    if (b.active !== undefined) patch.active = !!b.active;
    res.json({ data: db.update('mechanics', row.id, patch) });
  })
);

router.delete(
  '/mechanics/:id',
  requireRole('owner'),
  asyncHandler((req, res) => {
    if (!db.byId('mechanics', req.params.id))
      return res.status(404).json({ error: 'Mekanik tidak ditemukan.' });
    db.remove('mechanics', req.params.id);
    res.json({ ok: true });
  })
);

/* ============================== PENGGUNA ============================== */

router.get(
  '/users',
  requireRole('owner'),
  asyncHandler((_req, res) => {
    res.json({ data: db.all('users').map(publicUser) });
  })
);

router.post(
  '/users',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const err = requireFields(b, ['username', 'name', 'password']);
    if (err) return badRequest(res, err);
    const username = String(b.username).trim().toLowerCase();
    if (db.findOne('users', (u) => u.username.toLowerCase() === username))
      return badRequest(res, 'Username sudah dipakai.');
    if (String(b.password).length < 4)
      return badRequest(res, 'Password minimal 4 karakter.');

    const { hashPassword } = await import('../auth.js');
    res.status(201).json({
      data: publicUser(
        db.insert('users', {
          username,
          name: String(b.name).trim(),
          role: b.role === 'owner' ? 'owner' : 'kasir',
          passwordHash: hashPassword(String(b.password)),
          active: b.active === false ? false : true,
        })
      ),
    });
  })
);

router.put(
  '/users/:id',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const row = db.byId('users', req.params.id);
    if (!row) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    const b = req.body || {};
    const patch = {};
    if (b.name !== undefined) patch.name = String(b.name).trim();
    if (b.username !== undefined) {
      const username = String(b.username).trim().toLowerCase();
      if (db.findOne('users', (u) => u.username.toLowerCase() === username && u.id !== row.id))
        return badRequest(res, 'Username sudah dipakai.');
      patch.username = username;
    }
    if (b.role !== undefined) {
      // Cegah situasi tanpa owner: tidak boleh menurunkan owner terakhir
      if (row.role === 'owner' && b.role !== 'owner') {
        const owners = db.find('users', (u) => u.role === 'owner' && u.active !== false);
        if (owners.length <= 1)
          return badRequest(res, 'Minimal harus ada satu akun owner aktif.');
      }
      patch.role = b.role === 'owner' ? 'owner' : 'kasir';
    }
    if (b.active !== undefined) {
      if (row.role === 'owner' && !b.active) {
        const owners = db.find('users', (u) => u.role === 'owner' && u.active !== false);
        if (owners.length <= 1) return badRequest(res, 'Akun owner terakhir tidak bisa dinonaktifkan.');
      }
      patch.active = !!b.active;
    }
    if (b.password) {
      if (String(b.password).length < 4) return badRequest(res, 'Password minimal 4 karakter.');
      const { hashPassword } = await import('../auth.js');
      patch.passwordHash = hashPassword(String(b.password));
    }
    res.json({ data: publicUser(db.update('users', row.id, patch)) });
  })
);

router.delete(
  '/users/:id',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const row = db.byId('users', req.params.id);
    if (!row) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    if (row.id === req.user.id) return badRequest(res, 'Tidak bisa menghapus akun yang sedang dipakai.');
    if (row.role === 'owner') {
      const owners = db.find('users', (u) => u.role === 'owner' && u.active !== false);
      if (owners.length <= 1) return badRequest(res, 'Minimal harus ada satu akun owner aktif.');
    }
    db.remove('users', row.id);
    for (const s of db.find('sessions', (s) => s.userId === row.id)) db.remove('sessions', s.id);
    res.json({ ok: true });
  })
);

/* ============================== HELPERS ============================== */

/** Role kasir tidak boleh melihat harga modal (costPrice). */
function stripCostForKasir(req) {
  return (row) => {
    if (req.user?.role === 'owner') return row;
    const { costPrice, supplier, ...rest } = row;
    return rest;
  };
}

export default router;
