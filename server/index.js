import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';

import db, { load, DATA_DIR, backup } from './db.js';
import { attachUser, pruneSessions } from './auth.js';

import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import customerRoutes from './routes/customers.js';
import transactionRoutes from './routes/transactions.js';
import workOrderRoutes from './routes/workorders.js';
import expenseRoutes from './routes/expenses.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import hardwareRoutes from './routes/hardware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------- boot ---

load();
pruneSessions();

if (db.count('users') === 0) {
  console.log('[boot] Database kosong, membuat data awal...');
  await import('./seed.js');
  load();
}

// Backup otomatis sekali sehari saat aplikasi pertama kali dijalankan
try {
  const marker = path.join(DATA_DIR, '.last-backup');
  const today = new Date().toISOString().slice(0, 10);
  const last = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : '';
  if (last !== today) {
    backup({ label: 'auto' });
    fs.writeFileSync(marker, today, 'utf8');
  }
} catch (err) {
  console.warn('[boot] Backup otomatis gagal:', err.message);
}

// ---------------------------------------------------------------- app ---

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(attachUser);

// ---------------------------------------------------------------- api ---

app.use('/api/auth', authRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api', catalogRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, version: '1.0.0', time: new Date().toISOString() })
);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

// --------------------------------------------------------------- static ---

if (fs.existsSync(DIST_DIR)) {
  // Mode normal: antarmuka sudah di-build, langsung sajikan.
  app.use(express.static(DIST_DIR, { maxAge: IS_PROD ? '1h' : 0, index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
} else {
  // Mode pengembangan: jalankan `npm run dev` (Vite di port 5173) untuk antarmuka.
  app.get('*', (_req, res) =>
    res
      .status(503)
      .type('html')
      .send(
        `<meta charset="utf-8"><body style="font-family:Segoe UI,sans-serif;padding:40px;background:#f1f5f9;color:#0f172a"><h2>Antarmuka belum di-build</h2><p>Jalankan salah satu perintah berikut di folder aplikasi:</p><pre style="background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px">npm run build\nnode server/index.js</pre><p>Atau untuk pengembangan:</p><pre style="background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px">npm run dev</pre><p>Lalu buka <a href="http://localhost:5173">http://localhost:5173</a></p></body>`
      )
  );
}

// ----------------------------------------------------------- error handler ---

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.message || 'Terjadi kesalahan pada server.' });
});

// ---------------------------------------------------------------- start ---

function lanAddresses() {
  const list = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) list.push(i.address);
    }
  }
  return list;
}

app.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log('');
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log('  │   KASIR PINTAR BENGKEL — siap digunakan       │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log(`  Alamat      : http://${shown}:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(`  Jaringan LAN: http://${ip}:${PORT}  (perangkat lain dalam wifi yang sama)`);
  }
  console.log(`  Data        : ${DATA_DIR}`);
  console.log('');
});
