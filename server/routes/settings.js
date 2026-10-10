import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import db, { DATA_DIR, backup, dataInfo, flush, load } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler, badRequest, intNum, num } from '../util.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler((req, res) => {
    const settings = db.getSettings();
    const safe = req.user.role === 'owner' ? settings : settings;
    res.json({ data: safe, info: dataInfo() });
  })
);

router.put(
  '/',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const b = req.body || {};
    const patch = {};
    for (const key of ['workshopName', 'tagline', 'address', 'phone', 'footerNote', 'location']) {
      if (b[key] !== undefined) patch[key] = String(b[key]).trim();
    }
    if (b.taxEnabled !== undefined) patch.taxEnabled = !!b.taxEnabled;
    if (b.lowStockAlert !== undefined) patch.lowStockAlert = !!b.lowStockAlert;
    if (b.printAutoOpen !== undefined) patch.printAutoOpen = !!b.printAutoOpen;
    if (b.taxPercent !== undefined) patch.taxPercent = num(b.taxPercent);
    if (b.receiptWidth !== undefined) patch.receiptWidth = intNum(b.receiptWidth, 58);

    // Pengaturan perangkat keras (printer, laci, scanner)
    for (const key of [
      'printerType',
      'printerName',
      'printerHost',
      'comPort',
    ]) {
      if (b[key] !== undefined) patch[key] = String(b[key]).trim();
    }
    for (const key of ['printerPort', 'baudRate', 'printCopies', 'drawerPin']) {
      if (b[key] !== undefined) patch[key] = intNum(b[key]);
    }
    for (const key of ['printerAutoCut', 'openDrawerOnCash', 'scannerEnterAddsItem', 'scannerBeep']) {
      if (b[key] !== undefined) patch[key] = !!b[key];
    }
    if (patch.printCopies !== undefined) {
      patch.printCopies = Math.min(3, Math.max(1, patch.printCopies || 1));
    }

    res.json({ data: db.setSettings(patch) });
  })
);

/* ------------------------------ Backup ------------------------------ */

router.get(
  '/backups',
  requireRole('owner'),
  asyncHandler((_req, res) => {
    const dir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(dir)) return res.json({ data: [] });
    const data = fs
      .readdirSync(dir)
      .map((name) => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        return {
          name,
          createdAt: stat.mtime.toISOString(),
          files: stat.isDirectory() ? fs.readdirSync(full).length : 0,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ data });
  })
);

router.post(
  '/backups',
  requireRole('owner'),
  asyncHandler((_req, res) => {
    const target = backup({ label: 'manual' });
    res.json({ data: { path: target } });
  })
);

router.get(
  '/backups/:name/download',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const dir = path.join(DATA_DIR, 'backups');
    const target = path.join(dir, req.params.name);
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory())
      return res.status(404).json({ error: 'Backup tidak ditemukan.' });

    const payload = {};
    for (const f of fs.readdirSync(target)) {
      if (!f.endsWith('.json')) continue;
      payload[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(target, f), 'utf8'));
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  })
);

/** Pulihkan dari file backup (JSON berisi seluruh koleksi). */
router.post(
  '/restore',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const payload = req.body?.data || req.body;
    if (!payload || typeof payload !== 'object')
      return badRequest(res, 'Berkas backup tidak valid.');

    const allowed = [
      'users',
      'products',
      'services',
      'service_categories',
      'customers',
      'vehicles',
      'mechanics',
      'work_orders',
      'transactions',
      'expenses',
      'stock_movements',
    ];
    const keys = Object.keys(payload).filter((k) => allowed.includes(k));
    if (!keys.length) return badRequest(res, 'Berkas backup tidak berisi data yang dikenal.');

    backup({ label: 'before-restore' });

    for (const key of keys) {
      if (Array.isArray(payload[key])) {
        const rows = db.all(key);
        rows.length = 0;
        rows.push(...payload[key]);
      }
    }
    if (payload.settings && typeof payload.settings === 'object') db.setSettings(payload.settings);
    flush();
    load();

    res.json({ data: { restored: keys } });
  })
);

export default router;
