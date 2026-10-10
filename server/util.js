/** Helper bersama untuk route API. */
import db from './db.js';

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

export function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function intNum(value, fallback = 0) {
  return Math.round(num(value, fallback));
}

export function requireFields(body, fields) {
  const missing = fields.filter((f) => {
    const v = body[f];
    return v === undefined || v === null || (typeof v === 'string' && !v.trim());
  });
  return missing.length ? `Kolom wajib diisi: ${missing.join(', ')}` : null;
}

/** Nomor urut berikutnya untuk kode seperti SP-001 / JS-001. */
export function nextCode(collection, prefix, prefixField = 'code') {
  const exists = new Set(
    db
      .all(collection)
      .map((r) => String(r[prefixField] || ''))
      .filter((c) => c.startsWith(prefix))
  );
  let i = 1;
  while (exists.has(`${prefix}-${String(i).padStart(3, '0')}`)) i += 1;
  return `${prefix}-${String(i).padStart(3, '0')}`;
}

/** Rentang tanggal inklusif; `from`/`to` format YYYY-MM-DD (opsional). */
export function dateRange(from, to) {
  const start = from
    ? new Date(`${from}T00:00:00.000`)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
  return { start, end };
}

export function inRange(iso, start, end) {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(offsetMonths = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function ymd(date) {
  const d = new Date(date);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** CSV aman (escape kutip & karakter formula). */
export function csvEscape(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows, headers) {
  const lines = [headers.map((h) => csvEscape(h.label)).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(h.value(row))).join(','));
  }
  // BOM supaya Excel di Windows membaca UTF-8 dengan benar
  return `﻿${lines.join('\r\n')}`;
}

/** Filter transaksi yang sudah dibayar & tidak dibatalkan. */
export function paidTransactions() {
  return db.find('transactions', (t) => t.status === 'paid');
}

/** Laba kotor sebuah transaksi: (harga jual - modal) x qty - diskon. */
export function transactionProfit(trx) {
  let profit = 0;
  for (const it of trx.items || []) {
    const cost = it.type === 'product' ? num(it.costPrice) : 0;
    profit += (num(it.price) - cost) * num(it.qty) - num(it.discount);
  }
  return profit;
}

export const PAYMENT_LABELS = {
  cash: 'Tunai',
  transfer: 'Transfer Bank',
  qris: 'QRIS',
  debit: 'Kartu Debit',
  credit: 'Kredit / Bon',
};

export const WO_STATUS_LABELS = {
  menunggu: 'Menunggu',
  dikerjakan: 'Dikerjakan',
  selesai: 'Selesai',
  diambil: 'Diambil',
};
