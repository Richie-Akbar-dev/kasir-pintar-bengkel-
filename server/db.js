/**
 * Lapisan penyimpanan lokal (tanpa database server & tanpa native module).
 *
 * Data disimpan sebagai file JSON di dalam folder `data/` pada komputer/laptop.
 * Penulisan dilakukan secara atomik (tulis ke file sementara -> rename) supaya
 * file tidak rusak jika listrik/tiba-tiba aplikasi mati.
 *
 * Untuk aplikasi bengkel skala UMKM (puluhan ribu transaksi) pendekatan ini
 * lebih dari cukup, mudah di-backup (cukup salin folder `data/`), dan yang
 * terpenting: `npm install` tidak butuh compiler / build tools di Windows.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');

// Bisa diarahkan ke folder lain lewat env, mis. ke OneDrive / D:\DataBengkel
export const DATA_DIR =
  process.env.KASIR_DATA_DIR || path.join(ROOT_DIR, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

/** Daftar koleksi. Koleksi bernilai objek tunggal ditandai `single: true`. */
const COLLECTIONS = [
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
  'sessions',
];

const SINGLETONS = ['settings'];

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function fileFor(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

/** cache di memori: { [collection]: any[] } */
const store = new Map();

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    // Jika file rusak, jangan diam-diam menghapus data pengguna: amankan dulu.
    const corrupt = `${file}.corrupt-${Date.now()}`;
    try {
      fs.copyFileSync(file, corrupt);
    } catch (_) {
      /* ignore */
    }
    console.error(
      `[db] Gagal membaca ${file} (${err.message}). Salinan disimpan di ${corrupt}, memakai nilai default.`
    );
    return fallback;
  }
}

/** Tulis atomik: tulis ke .tmp lalu rename. */
function writeJson(file, value) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

export function load() {
  ensureDirs();
  store.clear();
  for (const name of COLLECTIONS) {
    store.set(name, readJson(fileFor(name), []));
  }
  for (const name of SINGLETONS) {
    store.set(name, readJson(fileFor(name), {}));
  }
  return db;
}

function persist(name) {
  ensureDirs();
  writeJson(fileFor(name), store.get(name));
}

/** Simpan semua koleksi sekaligus (dipakai seed / backup). */
export function flush() {
  ensureDirs();
  for (const name of store.keys()) persist(name);
}

export function uid(prefix = '') {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  return prefix ? `${prefix}_${id}` : id;
}

export function nowIso() {
  return new Date().toISOString();
}

const db = {
  /** Ambil semua baris sebuah koleksi (salinan array). */
  all(name) {
    const rows = store.get(name);
    if (!rows) throw new Error(`Koleksi tidak dikenal: ${name}`);
    return rows;
  },

  find(name, predicate = () => true) {
    return db.all(name).filter(predicate);
  },

  findOne(name, predicate) {
    return db.all(name).find(predicate) || null;
  },

  byId(name, id) {
    return db.all(name).find((row) => row.id === id) || null;
  },

  insert(name, row, { persistNow = true } = {}) {
    const rows = store.get(name);
    if (!rows) throw new Error(`Koleksi tidak dikenal: ${name}`);
    const ts = nowIso();
    const full = {
      ...row,
      id: row.id || uid(),
      createdAt: row.createdAt || ts,
      updatedAt: row.updatedAt || ts,
    };
    rows.push(full);
    if (persistNow) persist(name);
    return full;
  },

  insertMany(name, rows) {
    const inserted = rows.map((r) => db.insert(name, r, { persistNow: false }));
    persist(name);
    return inserted;
  },

  update(name, id, patch) {
    const rows = store.get(name);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...patch, updatedAt: nowIso() };
    persist(name);
    return rows[idx];
  },

  remove(name, id) {
    const rows = store.get(name);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    persist(name);
    return true;
  },

  count(name, predicate) {
    return predicate ? db.find(name, predicate).length : db.all(name).length;
  },

  // ---- singleton (settings) ----
  getSettings() {
    return store.get('settings') || {};
  },

  setSettings(patch) {
    const current = store.get('settings') || {};
    const next = { ...current, ...patch, updatedAt: nowIso() };
    store.set('settings', next);
    persist('settings');
    return next;
  },
};

/** Backup harian sederhana: simpan salinan semua file JSON ke data/backups. */
export function backup({ label = 'auto' } = {}) {
  ensureDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const target = path.join(BACKUP_DIR, `${label}-${stamp}`);
  fs.mkdirSync(target, { recursive: true });
  for (const name of [...COLLECTIONS, ...SINGLETONS]) {
    const src = fileFor(name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(target, `${name}.json`));
    }
  }
  // Rapikan: simpan maksimal 14 backup terakhir.
  const dirs = fs
    .readdirSync(BACKUP_DIR)
    .map((d) => ({ d, t: fs.statSync(path.join(BACKUP_DIR, d)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { d } of dirs.slice(14)) {
    fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });
  }
  return target;
}

export function dataInfo() {
  const files = [...COLLECTIONS, ...SINGLETONS]
    .map((name) => {
      const f = fileFor(name);
      return fs.existsSync(f) ? { name, bytes: fs.statSync(f).size } : null;
    })
    .filter(Boolean);
  return {
    dir: DATA_DIR,
    files,
    totalBytes: files.reduce((a, b) => a + b.bytes, 0),
  };
}

export default db;
