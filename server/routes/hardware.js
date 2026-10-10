import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler, badRequest } from '../util.js';
import {
  IS_WINDOWS,
  listPrinters,
  openDrawer,
  printBuffer,
  printerConfig,
  readScale,
  testPrinter,
  writeCustomerDisplay,
} from '../hardware/printer.js';
import { renderReceipt, renderTestReceipt, PAPER_CHARS } from '../hardware/escpos.js';

const router = Router();

/* ------------------------- Info & daftar printer ------------------------- */

router.get(
  '/status',
  requireRole('owner'),
  asyncHandler(async (_req, res) => {
    const settings = db.getSettings();
    const cfg = printerConfig(settings);
    let printers = [];
    if (IS_WINDOWS) {
      const list = await listPrinters();
      printers = list.printers || [];
    }
    res.json({
      data: {
        platform: process.platform,
        windows: IS_WINDOWS,
        config: cfg,
        printers,
        paperChars: PAPER_CHARS,
      },
    });
  })
);

router.get(
  '/printers',
  requireRole('owner'),
  asyncHandler(async (_req, res) => {
    res.json(await listPrinters());
  })
);

/* ------------------------------ Tes cetak ------------------------------ */

router.post(
  '/test-print',
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const settings = db.getSettings();
    const cfg = printerConfig(settings);
    const chars = PAPER_CHARS[Number(settings.receiptWidth) === 80 ? 80 : 58] || 32;

    const buffer = renderTestReceipt(settings, {
      chars,
      cut: cfg.autoCut,
      openDrawer: !!req.body?.openDrawer,
      drawerPin: cfg.drawerPin,
    });

    const result = await printBuffer(buffer, settings);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error || 'Gagal mencetak.', detail: result });
    }
    res.json({ ok: true, bytes: buffer.length, detail: result });
  })
);

router.post(
  '/test-connection',
  requireRole('owner'),
  asyncHandler(async (_req, res) => {
    res.json(await testPrinter(db.getSettings()));
  })
);

/* ------------------------------ Buka laci ------------------------------ */

router.post(
  '/open-drawer',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const result = await openDrawer(db.getSettings());
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    res.json({ ok: true });
  })
);

/* --------------------- Cetak struk sebuah transaksi --------------------- */

router.post(
  '/print-transaction/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const trx = db.byId('transactions', req.params.id);
    if (!trx) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });

    const settings = db.getSettings();
    const cfg = printerConfig(settings);
    const chars = PAPER_CHARS[Number(settings.receiptWidth) === 80 ? 80 : 58] || 32;

    const openLaci =
      cfg.openDrawerOnCash && (req.body?.openDrawer ?? trx.paymentMethod === 'cash');

    const buffer = renderReceipt(trx, settings, {
      chars,
      cut: cfg.autoCut,
      copies: cfg.copies,
      openDrawer: openLaci,
      drawerPin: cfg.drawerPin,
    });

    const result = await printBuffer(buffer, settings);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error || 'Gagal mencetak struk.' });
    }
    res.json({ ok: true, bytes: buffer.length, drawerOpened: !!openLaci });
  })
);

/* --------------------- Tampilan pelanggan & timbangan --------------------- */

router.post(
  '/display',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { line1 = '', line2 = '' } = req.body || {};
    const result = await writeCustomerDisplay(String(line1), String(line2), db.getSettings());
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    res.json({ ok: true });
  })
);

router.get(
  '/scale',
  requireRole('owner'),
  asyncHandler(async (_req, res) => {
    const result = await readScale(db.getSettings());
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    res.json({ data: { weight: result.weight, raw: result.raw } });
  })
);

/* --------------------- Simpan pengaturan perangkat --------------------- */

const PRINTER_KEYS = [
  'printerType',
  'printerName',
  'printerHost',
  'printerPort',
  'comPort',
  'baudRate',
  'printerAutoCut',
  'printCopies',
  'openDrawerOnCash',
  'drawerPin',
  'scannerEnterAddsItem',
  'scannerBeep',
];

router.put(
  '/settings',
  requireRole('owner'),
  asyncHandler((req, res) => {
    const b = req.body || {};
    const patch = {};
    for (const key of PRINTER_KEYS) {
      if (b[key] === undefined) continue;
      if (key === 'printerPort' || key === 'baudRate' || key === 'printCopies' || key === 'drawerPin') {
        patch[key] = Number(b[key]);
      } else if (key === 'printerAutoCut' || key === 'openDrawerOnCash' || key === 'scannerEnterAddsItem' || key === 'scannerBeep') {
        patch[key] = !!b[key];
      } else {
        patch[key] = String(b[key]).trim();
      }
    }
    if (patch.printerType && !['browser', 'windows', 'network', 'serial', 'file'].includes(patch.printerType)) {
      return badRequest(res, 'Jenis printer tidak dikenal.');
    }
    if (patch.printCopies !== undefined) {
      patch.printCopies = Math.min(3, Math.max(1, patch.printCopies || 1));
    }
    res.json({ data: db.setSettings(patch) });
  })
);

export default router;
