/**
 * Lapisan pengiriman data ke perangkat keras.
 *
 * Semua akses perangkat dilakukan di sini (sisi backend), karena browser tidak
 * diizinkan mengakses USB/serial. Tiga jalur kirim didukung:
 *
 *   windows → printer yang terpasang di Windows (tanpa dialog cetak)
 *   network → printer thermal jaringan (TCP, biasanya port 9100)
 *   serial  → port COM (printer serial, pole display, timbangan)
 *
 * Untuk Windows kami memanggil PowerShell bawaan sistem, sehingga aplikasi
 * TETAP tidak butuh native module (tidak perlu node-gyp / VS Build Tools).
 */
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.join(__dirname, 'scripts');

export const IS_WINDOWS = process.platform === 'win32';

/* ------------------------------- util ------------------------------- */

function runPowerShell(scriptName, args = [], { timeout = 30_000 } = {}) {
  return new Promise((resolve) => {
    const script = path.join(SCRIPTS_DIR, scriptName);
    const exe = process.env.POWERSHELL_PATH || 'powershell.exe';
    const fullArgs = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
      ...args,
    ];
    execFile(exe, fullArgs, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      const out = String(stdout || '').trim();
      if (error) {
        resolve({
          ok: false,
          output: out,
          error: out || String(stderr || '').trim() || error.message,
        });
      } else {
        resolve({ ok: !/^ERROR:/i.test(out), output: out, error: /^ERROR:/i.test(out) ? out : '' });
      }
    });
  });
}

/** Simpan buffer ke berkas sementara; pemanggil bertugas menghapusnya. */
function toTempFile(buffer, ext = '.bin') {
  const file = path.join(os.tmpdir(), `kpb-${crypto.randomBytes(8).toString('hex')}${ext}`);
  fs.writeFileSync(file, buffer);
  return file;
}

/* --------------------------- Daftar printer --------------------------- */

export async function listPrinters() {
  if (!IS_WINDOWS) {
    return {
      ok: false,
      printers: [],
      message: 'Daftar printer otomatis hanya tersedia di Windows. Pilih jenis "Jaringan" lalu isi alamat IP printer.',
    };
  }
  const res = await runPowerShell('list-printers.ps1', [], { timeout: 25_000 });
  if (!res.ok) {
    return { ok: false, printers: [], message: res.error || 'Gagal mengambil daftar printer.' };
  }
  let names = [];
  try {
    const parsed = JSON.parse(res.output || '[]');
    names = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch {
    names = res.output
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
  return { ok: true, printers: names.filter(Boolean), message: '' };
}

/* ------------------------------ Transport ------------------------------ */

async function sendToWindowsPrinter(printerName, buffer) {
  if (!printerName) return { ok: false, error: 'Nama printer belum dipilih.' };
  if (!IS_WINDOWS) return { ok: false, error: 'Pencetakan lewat driver Windows hanya bisa di Windows.' };

  const file = toTempFile(buffer);
  try {
    return await runPowerShell('print-raw.ps1', ['-PrinterName', printerName, '-FilePath', file], {
      timeout: 40_000,
    });
  } finally {
    try {
      fs.unlinkSync(file);
    } catch {
      /* abaikan */
    }
  }
}

function sendToNetwork(host, port, buffer) {
  return new Promise((resolve) => {
    if (!host) return resolve({ ok: false, error: 'Alamat IP printer belum diisi.' });

    const socket = new net.Socket();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(8000);
    socket.once('connect', () => {
      socket.write(buffer, (err) => {
        if (err) finish({ ok: false, error: `Gagal mengirim data: ${err.message}` });
        else {
          // Beri waktu printer mencetak sebelum menutup koneksi
          setTimeout(() => finish({ ok: true, output: 'OK' }), 300);
        }
      });
    });
    socket.once('timeout', () => finish({ ok: false, error: `Printer ${host}:${port} tidak merespons (timeout).` }));
    socket.once('error', (err) => finish({ ok: false, error: `Tidak dapat terhubung ke ${host}:${port} — ${err.message}` }));

    socket.connect(Number(port) || 9100, host);
  });
}

async function sendToSerial(comPort, baud, buffer) {
  if (!comPort) return { ok: false, error: 'Port COM belum dipilih.' };
  if (!IS_WINDOWS) return { ok: false, error: 'Port serial hanya didukung di Windows.' };

  const file = toTempFile(buffer);
  try {
    return await runPowerShell(
      'serial-write.ps1',
      ['-Port', comPort, '-Baud', String(baud || 9600), '-FilePath', file],
      { timeout: 30_000 }
    );
  } finally {
    try {
      fs.unlinkSync(file);
    } catch {
      /* abaikan */
    }
  }
}

/** Diagnostik: simpan ke berkas (berguna untuk memeriksa hasil ESC/POS). */
function sendToFile(buffer) {
  const dir = path.join(os.tmpdir(), 'kasir-pintar-struk');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `struk-${Date.now()}.bin`);
  fs.writeFileSync(file, buffer);
  return { ok: true, output: 'OK', debugFile: file };
}

/* ------------------------------- API ------------------------------- */

/** Ambil konfigurasi printer dari pengaturan dengan nilai bawaan. */
export function printerConfig(settings = {}) {
  return {
    type: settings.printerType || 'browser', // browser | windows | network | serial | file
    name: settings.printerName || '',
    host: settings.printerHost || '',
    port: Number(settings.printerPort) || 9100,
    comPort: settings.comPort || '',
    baudRate: Number(settings.baudRate) || 9600,
    autoCut: settings.printerAutoCut !== false,
    copies: Math.min(3, Math.max(1, Number(settings.printCopies) || 1)),
    openDrawerOnCash: settings.openDrawerOnCash !== false,
    drawerPin: Number(settings.drawerPin) === 5 ? 5 : 2,
  };
}

export async function printBuffer(buffer, settings = {}) {
  const cfg = printerConfig(settings);

  switch (cfg.type) {
    case 'windows':
      return sendToWindowsPrinter(cfg.name, buffer);
    case 'network':
      return sendToNetwork(cfg.host, cfg.port, buffer);
    case 'serial':
      return sendToSerial(cfg.comPort, cfg.baudRate, buffer);
    case 'file':
      return sendToFile(buffer);
    case 'browser':
    default:
      return { ok: false, error: 'Pencetakan langsung belum diaktifkan. Pilih jenis printer di Pengaturan → Perangkat.' };
  }
}

/** Kirim perintah buka laci saja. */
export async function openDrawer(settings = {}) {
  const cfg = printerConfig(settings);
  if (cfg.type === 'browser') {
    return { ok: false, error: 'Aktifkan printer langsung di Pengaturan → Perangkat terlebih dahulu.' };
  }
  const { EscPosBuilder } = await import('./escpos.js');
  const builder = new EscPosBuilder({ chars: 32 });
  builder.init();
  builder.openDrawer(cfg.drawerPin === 5 ? 1 : 0);
  return printBuffer(builder.toBuffer(), settings);
}

/** Kirim teks ke pole display (2 baris x 20 karakter). */
export async function writeCustomerDisplay(line1 = '', line2 = '', settings = {}) {
  const cfg = printerConfig(settings);
  if (!cfg.comPort) return { ok: false, error: 'Port COM untuk tampilan pelanggan belum diatur.' };

  const pad = (s) => String(s).slice(0, 20).padEnd(20, ' ');
  const payload = Buffer.concat([
    Buffer.from([0x1b, 0x40]), // init
    Buffer.from([0x0c]), // clear screen
    Buffer.from(pad(line1) + pad(line2), 'ascii'),
  ]);
  return sendToSerial(cfg.comPort, cfg.baudRate, payload);
}

/** Baca berat dari timbangan digital (satu baris). */
export async function readScale(settings = {}) {
  const cfg = printerConfig(settings);
  if (!cfg.comPort) return { ok: false, error: 'Port COM timbangan belum diatur.' };
  if (!IS_WINDOWS) return { ok: false, error: 'Pembacaan timbangan hanya didukung di Windows.' };

  const res = await runPowerShell(
    'serial-read.ps1',
    ['-Port', cfg.comPort, '-Baud', String(cfg.baudRate), '-TimeoutMs', '2500'],
    { timeout: 20_000 }
  );
  if (!res.ok) return res;

  const match = res.output.match(/(-?\d+[.,]?\d*)/);
  return { ok: true, raw: res.output, weight: match ? Number(match[1].replace(',', '.')) : null };
}

/** Cek koneksi printer tanpa mencetak struk transaksi. */
export async function testPrinter(settings = {}) {
  const cfg = printerConfig(settings);
  const checks = { platform: process.platform, windows: IS_WINDOWS, config: cfg };

  if (cfg.type === 'browser') {
    return { ok: false, ...checks, message: 'Mode cetak browser (struk HTML). Tidak ada perangkat yang diuji.' };
  }
  if (cfg.type === 'network') {
    try {
      await sendToNetwork(cfg.host, cfg.port, Buffer.from([0x1b, 0x40])); // ESC @
      return { ok: true, ...checks, message: `Printer ${cfg.host}:${cfg.port} merespons.` };
    } catch (err) {
      return { ok: false, ...checks, message: err.message };
    }
  }
  if (cfg.type === 'windows' || cfg.type === 'serial') {
    const printers = await listPrinters();
    return { ok: printers.ok, ...checks, printers: printers.printers, message: printers.message };
  }
  return { ok: true, ...checks, message: 'Mode berkas (diagnostik).' };
}
