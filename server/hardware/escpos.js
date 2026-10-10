/**
 * Pembuat perintah ESC/POS untuk printer thermal.
 *
 * Modul ini murni JavaScript (tanpa dependency & tanpa native module) dan
 * menghasilkan Buffer berisi perintah mentah yang bisa dikirim ke printer
 * lewat driver Windows, jaringan (TCP 9100), maupun port serial.
 */

/* ------------------------------- konstanta ------------------------------- */

const ESC = 0x1b;
const GS = 0x1d;

export const ALIGN = { LEFT: 0, CENTER: 1, RIGHT: 2 };

/** Lebar kertas dalam jumlah karakter (font A). */
export const PAPER_CHARS = { 58: 32, 80: 48 };

/**
 * Bersihkan teks agar aman untuk printer thermal.
 * Kebanyakan printer struk memakai code page 437/850 dan tidak mengenal
 * karakter di luar ASCII. Karakter beraksen umum ditransliterasi.
 */
const TRANSLITERATE = {
  'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
  'ñ': 'n', 'ç': 'c',
  'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A', 'Ã': 'A',
  'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
  'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
  'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Ö': 'O', 'Õ': 'O',
  'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
  'Ñ': 'N', 'Ç': 'C',
  // Tanda kutip & dash cantik
  '‘': "'", '’': "'", '“': '"', '”': '"',
  '–': '-', '—': '-', '…': '...', ' ': ' ',
  '•': '-', '·': '.',
};

export function sanitize(input) {
  let text = String(input ?? '');
  text = text.replace(/[^\x20-\x7E\n\r\t -￿]/g, (ch) => TRANSLITERATE[ch] ?? '?');
  // Ganti karakter yang tersisa di luar rentang aman
  text = text.replace(/[^\x20-\x7E\n\r\t]/g, '?');
  return text;
}

/* ------------------------------ pembangun ------------------------------ */

export class EscPosBuilder {
  constructor({ chars = 32, encoding = 'ascii' } = {}) {
    this.chars = chars;
    this.encoding = encoding;
    this.chunks = [];
  }

  raw(buffer) {
    this.chunks.push(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
    return this;
  }

  /** Mulai ulang printer & set code page. */
  init() {
    return this.raw([ESC, 0x40]); // ESC @
  }

  align(mode = ALIGN.LEFT) {
    return this.raw([ESC, 0x61, mode]); // ESC a n
  }

  bold(on = true) {
    return this.raw([ESC, 0x45, on ? 1 : 0]); // ESC E n
  }

  underline(on = true) {
    return this.raw([ESC, 0x2d, on ? 1 : 0]); // ESC - n
  }

  /** Ukuran huruf: width & height 1..8 (GS ! n) */
  size(width = 1, height = 1) {
    const w = Math.min(8, Math.max(1, Math.round(width)));
    const h = Math.min(8, Math.max(1, Math.round(height)));
    const n = ((w - 1) << 4) | (h - 1);
    return this.raw([GS, 0x21, n]);
  }

  /** Baris teks apa adanya (tanpa newline otomatis). */
  write(text) {
    this.chunks.push(Buffer.from(sanitize(text), this.encoding));
    return this;
  }

  /** Baris teks diakhiri newline. */
  line(text = '') {
    return this.write(`${sanitize(text)}\n`);
  }

  /** Pecah teks panjang menjadi beberapa baris sesuai lebar kertas. */
  wrap(text, indent = 0) {
    const words = sanitize(text).split(/\s+/).filter(Boolean);
    if (!words.length) return this.line('');

    const width = Math.max(8, this.chars - indent);
    const pad = ' '.repeat(indent);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= width) {
        current = candidate;
      } else {
        if (current) this.line(pad + current);
        // Potong kata yang lebih panjang dari lebar kertas
        let rest = word;
        while (rest.length > width) {
          this.line(pad + rest.slice(0, width));
          rest = rest.slice(width);
        }
        current = rest;
      }
    }
    if (current) this.line(pad + current);
    return this;
  }

  /** Baris kiri–kanan (untuk nama item + harga). */
  row(left, right, { gap = 1 } = {}) {
    const l = sanitize(left);
    const r = sanitize(right);
    const space = Math.max(gap, this.chars - l.length - r.length);
    if (l.length + r.length + gap > this.chars) {
      // Nilai terlalu panjang: taruh nilai di baris sendiri, rata kanan
      this.line(l.slice(0, this.chars));
      return this.line(r.padStart(this.chars));
    }
    return this.line(l + ' '.repeat(space) + r);
  }

  /** Garis pemisah. */
  separator(char = '-') {
    return this.line(char.repeat(this.chars));
  }

  feed(lines = 1) {
    return this.raw([ESC, 0x64, Math.min(255, Math.max(1, lines))]); // ESC d n
  }

  /** Potong kertas (bila printer mendukung). */
  cut({ partial = true, feed = 4 } = {}) {
    this.feed(feed);
    return this.raw([GS, 0x56, partial ? 0x42 : 0x41, 0x00]); // GS V B/A
  }

  /** Buka laci uang. pin 0 = pin 2 (RJ11), pin 1 = pin 5. */
  openDrawer(pin = 0) {
    // ESC p m t1 t2  →  m: 0/48 = pin 2, 1/49 = pin 5
    return this.raw([ESC, 0x70, pin === 1 ? 0x01 : 0x00, 0x19, 0xfa]);
  }

  /** Bunyi buzzer bila printer mendukung. */
  beep(times = 1, duration = 2) {
    return this.raw([ESC, 0x42, Math.min(9, times), Math.min(9, duration)]);
  }

  toBuffer() {
    return Buffer.concat(this.chunks);
  }
}

/* ---------------------------- format rupiah ---------------------------- */

function rp(value) {
  const n = Math.round(Number(value || 0));
  return n.toLocaleString('id-ID');
}

function padLeft(text, width) {
  return String(text).length >= width ? String(text) : ' '.repeat(width - String(text).length) + text;
}

/* --------------------------- render struk --------------------------- */

/**
 * Bangun struk transaksi siap cetak.
 * @param {object} trx  data transaksi
 * @param {object} settings  pengaturan bengkel
 * @param {object} options  { chars, cut, openDrawer, copies }
 */
export function renderReceipt(trx, settings = {}, options = {}) {
  const widthMm = Number(settings.receiptWidth) === 80 ? 80 : 58;
  const chars = options.chars || PAPER_CHARS[widthMm] || 32;
  const b = new EscPosBuilder({ chars });

  const s = {
    workshopName: settings.workshopName || 'BENGKEL',
    tagline: settings.tagline || '',
    address: settings.address || '',
    phone: settings.phone || '',
    footerNote: settings.footerNote || '',
  };

  b.init();
  b.align(ALIGN.CENTER);
  b.bold(true);
  b.size(1, 2);
  b.line(s.workshopName.toUpperCase());
  b.size(1, 1);
  b.bold(false);
  if (s.tagline) b.line(s.tagline);
  if (s.address) b.wrap(s.address);
  if (s.phone) b.line(s.phone);
  b.separator();

  // --- Info transaksi ---
  b.align(ALIGN.LEFT);
  const tanggal = new Date(trx.date || Date.now()).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  b.row(trx.code || '-', tanggal);

  const kasir = trx.userName || '-';
  const metode = labelPembayaran(trx.paymentMethod);
  b.row(`Kasir: ${kasir}`.slice(0, chars - metode.length - 1), metode);

  const pelanggan = trx.customerName || 'Pelanggan Umum';
  const denganPlat = `Pelanggan: ${pelanggan}${trx.plateNumber ? ` / ${trx.plateNumber}` : ''}`;
  if (denganPlat.length <= chars) {
    b.line(denganPlat);
  } else {
    b.wrap(`Pelanggan: ${pelanggan}`);
    if (trx.plateNumber) b.line(`Plat: ${trx.plateNumber}`);
  }
  if (trx.vehicleLabel) b.wrap(`Kendaraan: ${trx.vehicleLabel}`);
  b.separator();

  // --- Item ---
  for (const item of trx.items || []) {
    b.wrap(item.name);
    const kiri = `  ${item.qty} ${item.unit || ''} x ${rp(item.price)}`;
    const kanan = rp(item.subtotal);
    if (item.discount > 0) {
      b.row(kiri, kanan);
      b.row(`  Diskon`, `-${rp(item.discount)}`);
    } else {
      b.row(kiri, kanan);
    }
  }
  b.separator();

  // --- Ringkasan ---
  b.row('Subtotal', rp(trx.subtotal));
  if (trx.discountTotal > 0) b.row('Diskon', `-${rp(trx.discountTotal)}`);
  if (trx.taxAmount > 0) b.row(`PPN ${trx.taxPercent || 0}%`, rp(trx.taxAmount));

  b.bold(true);
  b.row('TOTAL', rp(trx.total));
  b.bold(false);

  if (trx.paymentMethod === 'cash') {
    b.row('Tunai', rp(trx.paidAmount));
    b.row('Kembali', rp(trx.changeAmount));
  } else if (trx.paymentMethod === 'credit') {
    b.bold(true);
    b.line('*** BELUM LUNAS (BON) ***');
    b.bold(false);
  } else {
    b.row('Dibayar', rp(trx.total));
  }
  b.separator();

  // --- Catatan kaki ---
  b.align(ALIGN.CENTER);
  if (s.footerNote) b.wrap(s.footerNote);
  b.line('Terima kasih atas kunjungan Anda');
  b.line('-- Semoga selamat sampai tujuan --');

  if (trx.status === 'void') {
    b.separator('=');
    b.bold(true);
    b.line('*** TRANSAKSI DIBATALKAN ***');
    b.bold(false);
    if (trx.voidReason) b.wrap(trx.voidReason);
  }

  if (options.openDrawer) b.openDrawer(options.drawerPin === 5 ? 1 : 0);
  if (options.cut !== false) b.cut({ partial: true, feed: 4 });

  const buf = b.toBuffer();
  const copies = Math.min(3, Math.max(1, Number(options.copies) || 1));
  return copies > 1 ? Buffer.concat(Array.from({ length: copies }, () => buf)) : buf;
}

/** Struk uji coba untuk memastikan konfigurasi printer benar. */
export function renderTestReceipt(settings = {}, options = {}) {
  const widthMm = Number(settings.receiptWidth) === 80 ? 80 : 58;
  const chars = options.chars || PAPER_CHARS[widthMm] || 32;
  const b = new EscPosBuilder({ chars });

  b.init();
  b.align(ALIGN.CENTER);
  b.bold(true);
  b.size(1, 2);
  b.line((settings.workshopName || 'BENGKEL').toUpperCase());
  b.size(1, 1);
  b.bold(false);
  b.separator('=');
  b.bold(true);
  b.line('TES CETAK BERHASIL');
  b.bold(false);
  b.separator('=');
  b.align(ALIGN.LEFT);
  b.row('Lebar kertas', `${widthMm} mm`);
  b.row('Karakter/baris', String(chars));
  b.row('Waktu', new Date().toLocaleString('id-ID'));
  b.separator();
  b.align(ALIGN.CENTER);
  b.line('1234567890 abcdefghij');
  b.line('Jika teks ini terbaca,');
  b.line('printer siap digunakan.');
  b.feed(2);
  if (options.openDrawer) b.openDrawer(options.drawerPin === 5 ? 1 : 0);
  if (options.cut !== false) b.cut({ partial: true, feed: 4 });
  return b.toBuffer();
}

export function labelPembayaran(method) {
  const map = {
    cash: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
    debit: 'Debit',
    credit: 'Bon',
  };
  return map[method] || method || '-';
}

export { padLeft };
