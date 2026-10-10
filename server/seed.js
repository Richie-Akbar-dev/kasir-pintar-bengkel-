/**
 * Data awal aplikasi.
 *   node server/seed.js           -> isi data contoh hanya jika database masih kosong
 *   node server/seed.js --reset   -> hapus semua data lalu isi ulang dari awal
 */
import fs from 'node:fs';
import path from 'node:path';
import db, { load, DATA_DIR, uid, backup } from './db.js';
import { hashPassword } from './auth.js';

const RESET = process.argv.includes('--reset');

/** PRNG deterministik supaya data contoh selalu sama setiap kali di-seed. */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20240917);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

// ---------------------------------------------------------------- katalog ---

const PRODUCTS = [
  // [nama, kategori, satuan, hargaBeli, hargaJual, stok, stokMin]
  ['Oli Mesin Yamalube Matic 0,8L', 'Oli & Pelumas', 'Botol', 38000, 55000, 46, 12],
  ['Oli Mesin Shell Advance 10W-40 1L', 'Oli & Pelumas', 'Botol', 52000, 75000, 34, 10],
  ['Oli Gardan 120ml', 'Oli & Pelumas', 'Botol', 14000, 22000, 40, 10],
  ['Oli Mesin Mobil 10W-40 4L', 'Oli & Pelumas', 'Jerigen', 215000, 285000, 18, 6],
  ['Busi NGK C7HSA', 'Mesin', 'Pcs', 12000, 20000, 60, 15],
  ['Busi NGK G-Power CR8EGP', 'Mesin', 'Pcs', 24000, 38000, 36, 10],
  ['Busi Iridium Mobil Denso SK20HR11', 'Mesin', 'Pcs', 78000, 115000, 16, 6],
  ['Filter Udara Vario 150', 'Filter', 'Pcs', 28000, 45000, 24, 8],
  ['Filter Oli Mobil Toyota', 'Filter', 'Pcs', 35000, 55000, 20, 6],
  ['Filter Bensin Mobil', 'Filter', 'Pcs', 62000, 95000, 12, 4],
  ['Kampas Rem Depan Vario 125', 'Rem', 'Set', 45000, 75000, 22, 6],
  ['Kampas Rem Belakang Mio', 'Rem', 'Set', 38000, 62000, 20, 6],
  ['Kampas Rem Mobil Avanza Depan', 'Rem', 'Set', 165000, 240000, 10, 4],
  ['Minyak Rem DOT 3 250ml', 'Rem', 'Botol', 18000, 30000, 26, 8],
  ['Ban Aspira 80/90-14', 'Ban', 'Pcs', 135000, 195000, 14, 4],
  ['Ban Aspira 90/90-14', 'Ban', 'Pcs', 148000, 210000, 12, 4],
  ['Ban Mobil Dunlop 185/70 R14', 'Ban', 'Pcs', 520000, 690000, 8, 3],
  ['Aki GS Astra GTZ-5 (12V 5Ah)', 'Aki', 'Pcs', 165000, 235000, 9, 3],
  ['Aki Mobil NS40ZL (12V 45Ah)', 'Aki', 'Pcs', 620000, 820000, 6, 2],
  ['V-Belt / Van Belt Mio', 'Transmisi', 'Pcs', 68000, 105000, 18, 5],
  ['Kampas Kopling Sentrifugal', 'Transmisi', 'Set', 72000, 115000, 14, 5],
  ['Rantai Set + Gir CVT', 'Transmisi', 'Set', 145000, 215000, 8, 3],
  ['Shockbreaker Belakang Vario', 'Kaki-kaki', 'Pcs', 175000, 265000, 10, 3],
  ['Bearing 6201-2RS', 'Kaki-kaki', 'Pcs', 16000, 28000, 40, 10],
  ['Lampu LED H4 12V', 'Kelistrikan', 'Pcs', 65000, 95000, 22, 6],
  ['Kabel Gas Vario', 'Kelistrikan', 'Pcs', 22000, 38000, 25, 6],
  ['Coolant Radiator 1L', 'Pendingin', 'Botol', 32000, 52000, 24, 6],
  ['Wiper Mobil 22 inch', 'Aksesoris', 'Pcs', 45000, 75000, 16, 5],
  ['Sarung Tangan Mekanik', 'Perlengkapan', 'Pasang', 14000, 25000, 30, 8],
  ['Majun / Kain Lap 1kg', 'Perlengkapan', 'Pack', 18000, 30000, 18, 5],
];

const SERVICE_CATEGORIES = [
  'Servis Berkala',
  'Servis Mesin',
  'Rem & Kaki-kaki',
  'Kelistrikan',
  'Ban & Roda',
  'Cuci & detailing',
  'AC Mobil',
];

const SERVICES = [
  // [nama, kategori, harga, durasiMenit]
  ['Ganti Oli Motor', 'Servis Berkala', 25000, 20],
  ['Servis Ringan Motor (oli + tune up)', 'Servis Berkala', 55000, 45],
  ['Servis Lengkap Motor', 'Servis Berkala', 95000, 90],
  ['Servis CVT / Van Belt', 'Servis Mesin', 85000, 60],
  ['Tune Up Injeksi Motor', 'Servis Mesin', 75000, 45],
  ['Bongkar Mesin (overhaul)', 'Servis Mesin', 450000, 480],
  ['Ganti Kampas Rem Motor', 'Rem & Kaki-kaki', 40000, 30],
  ['Ganti Shockbreaker', 'Rem & Kaki-kaki', 90000, 60],
  ['Ganti Bearing Roda', 'Rem & Kaki-kaki', 70000, 45],
  ['Spooring & Balancing Mobil', 'Rem & Kaki-kaki', 150000, 60],
  ['Ganti Kampas Rem Mobil', 'Rem & Kaki-kaki', 175000, 90],
  ['Perbaikan Kelistrikan (per jam)', 'Kelistrikan', 100000, 60],
  ['Ganti Aki', 'Kelistrikan', 35000, 20],
  ['Ganti Lampu / Instalasi LED', 'Kelistrikan', 50000, 30],
  ['Ganti Ban Motor', 'Ban & Roda', 30000, 25],
  ['Ganti Ban Mobil (4 ban)', 'Ban & Roda', 150000, 75],
  ['Tambal Ban Tubeless', 'Ban & Roda', 20000, 20],
  ['Cuci Motor Reguler', 'Cuci & detailing', 15000, 30],
  ['Cuci Motor Premium + Wax', 'Cuci & detailing', 40000, 60],
  ['Cuci Mobil Interior + Eksterior', 'Cuci & detailing', 90000, 90],
  ['Service AC Mobil', 'AC Mobil', 250000, 120],
  ['Isi Freon AC Mobil', 'AC Mobil', 175000, 60],
];

const MECHANICS = [
  ['Samsul Hadi', '0812-3344-5566', 45],
  ['Joko Susilo', '0813-9988-7711', 40],
  ['Budi Santoso', '0857-2211-4433', 40],
  ['Andi Wijaya', '0878-6655-3322', 35],
];

const CUSTOMERS = [
  ['Andi Kurniawan', '0812-1234-5678', 'Jl. Pahlawan No. 12, Sidoarjo'],
  ['Siti Rahayu', '0813-2345-6789', 'Jl. Diponegoro No. 45, Sidoarjo'],
  ['Bambang Supriyanto', '0856-3456-7890', 'Jl. Raya Tropodo No. 8, Waru'],
  ['Rina Kartika', '0878-4567-8901', 'Jl. Ahmad Yani No. 77, Sidoarjo'],
  ['Dedi Prasetyo', '0819-5678-9012', 'Jl. Sudirman No. 3, Gedangan'],
  ['Nurul Hidayah', '0857-6789-0123', 'Jl. Sunan Ampel No. 21, Sidoarjo'],
  ['Hendra Gunawan', '0821-7890-1234', 'Jl. Raya Buduran No. 55, Buduran'],
  ['Wulan Anggraini', '0831-8901-2345', 'Jl. Pucang Anom No. 9, Sidoarjo'],
  ['Fajar Nugroho', '0888-9012-3456', 'Jl. Raya Candi No. 140, Sidoarjo'],
  ['Maya Sari', '0877-0123-4567', 'Jl. Kartini No. 30, Sidoarjo'],
];

const VEHICLES = [
  // [indexCustomer, nomorPolisi, merek, model, tahun, jenis]
  [0, 'W 1234 AB', 'Honda', 'Vario 125', 2019, 'Motor'],
  [0, 'W 5678 CD', 'Toyota', 'Avanza', 2017, 'Mobil'],
  [1, 'W 2468 EF', 'Yamaha', 'Mio M3', 2020, 'Motor'],
  [2, 'W 1357 GH', 'Honda', 'Beat Street', 2021, 'Motor'],
  [2, 'W 8642 IJ', 'Mitsubishi', 'Xpander', 2019, 'Mobil'],
  [3, 'W 9753 KL', 'Suzuki', 'Nex II', 2018, 'Motor'],
  [4, 'W 1122 MN', 'Toyota', 'Kijang Innova', 2016, 'Mobil'],
  [5, 'W 3344 OP', 'Honda', 'Scoopy', 2022, 'Motor'],
  [6, 'W 5566 QR', 'Yamaha', 'NMAX 155', 2021, 'Motor'],
  [6, 'W 7788 ST', 'Daihatsu', 'Xenia', 2018, 'Mobil'],
  [7, 'W 9900 UV', 'Honda', 'PCX 160', 2022, 'Motor'],
  [8, 'W 2233 WX', 'Yamaha', 'Aerox 155', 2020, 'Motor'],
  [9, 'W 4455 YZ', 'Toyota', 'Calya', 2019, 'Mobil'],
];

const EXPENSES = [
  ['Bayar listrik bengkel', 'Listrik & Air', 450000, 26],
  ['Beli perlengkapan & majun', 'Perlengkapan', 320000, 22],
  ['Gaji karyawan tambahan', 'Gaji', 2500000, 15],
  ['Service kompresor angin', 'Perawatan Alat', 275000, 12],
  ['Bayar internet & telepon', 'Utilitas', 300000, 9],
  ['Beli tool set baru', 'Peralatan', 890000, 5],
  ['Konsumsi & air minum', 'Konsumsi', 180000, 3],
];

// ---------------------------------------------------------------- helpers ---

function pad(n, width = 4) {
  return String(n).padStart(width, '0');
}

function isoDaysAgo(days, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, Math.floor(rand() * 60), 0);
  return d.toISOString();
}

function roundToThousand(n) {
  return Math.round(n / 1000) * 1000;
}

// ------------------------------------------------------------------ seed ---

function seedAll() {
  load();

  // ---- Pengaturan bengkel ----
  db.setSettings({
    workshopName: 'Bengkel Pintar Sidoarjo',
    tagline: 'Servis Motor & Mobil Bergaransi',
    address: 'Jl. Raya Sidoarjo No. 88, Sidoarjo, Jawa Timur',
    phone: '0811-2233-4455',
    footerNote: 'Barang yang sudah dibeli tidak dapat dikembalikan. Terima kasih!',
    taxEnabled: false,
    taxPercent: 11,
    lowStockAlert: true,
    receiptWidth: 58, // mm — 58 atau 80
    printAutoOpen: true,

    // --- Perangkat keras ---
    printerType: 'browser', // browser | windows | network | serial | file
    printerName: '',
    printerHost: '',
    printerPort: 9100,
    comPort: '',
    baudRate: 9600,
    printerAutoCut: true,
    printCopies: 1,
    openDrawerOnCash: true,
    drawerPin: 2,
    scannerEnterAddsItem: true,
    scannerBeep: true,
  });

  // ---- Pengguna ----
  const ownerId = uid('usr');
  db.insert('users', {
    id: ownerId,
    username: 'owner',
    name: 'Pemilik Bengkel',
    role: 'owner',
    passwordHash: hashPassword('owner123'),
    active: true,
  });
  const kasirId = uid('usr');
  db.insert('users', {
    id: kasirId,
    username: 'kasir',
    name: 'Kasir Utama',
    role: 'kasir',
    passwordHash: hashPassword('kasir123'),
    active: true,
  });

  // ---- Kategori jasa ----
  const serviceCategories = SERVICE_CATEGORIES.map((name) =>
    db.insert('service_categories', { name })
  );

  // ---- Sparepart ----
  const products = PRODUCTS.map(([name, category, unit, cost, price, stock, minStock], i) =>
    db.insert('products', {
      code: `SP-${pad(i + 1, 3)}`,
      name,
      category,
      unit,
      costPrice: cost,
      sellPrice: price,
      stock,
      minStock,
      barcode: '',
      location: '',
      supplier: '',
      active: true,
      notes: '',
    })
  );

  // ---- Jasa servis ----
  const services = SERVICES.map(([name, category, price, duration], i) =>
    db.insert('services', {
      code: `JS-${pad(i + 1, 3)}`,
      name,
      category,
      price,
      durationMin: duration,
      active: true,
      notes: '',
    })
  );

  // ---- Mekanik ----
  const mechanics = MECHANICS.map(([name, phone, share]) =>
    db.insert('mechanics', {
      name,
      phone,
      sharePercent: share,
      active: true,
      notes: '',
    })
  );

  // ---- Pelanggan & kendaraan ----
  const customers = CUSTOMERS.map(([name, phone, address]) =>
    db.insert('customers', {
      name,
      phone,
      address,
      notes: '',
      active: true,
    })
  );

  const vehicles = VEHICLES.map(([custIdx, plate, brand, model, year, type]) =>
    db.insert('vehicles', {
      customerId: customers[custIdx].id,
      plateNumber: plate,
      brand,
      model,
      year,
      type,
      notes: '',
    })
  );

  const vehiclesByCustomer = new Map();
  for (const v of vehicles) {
    if (!vehiclesByCustomer.has(v.customerId)) vehiclesByCustomer.set(v.customerId, []);
    vehiclesByCustomer.get(v.customerId).push(v);
  }

  // ---- Transaksi historis (30 hari terakhir) ----
  const kasirUsers = [ownerId, kasirId];
  const kasirNames = new Map([
    [ownerId, 'Pemilik Bengkel'],
    [kasirId, 'Kasir Utama'],
  ]);
  const methods = [
    'cash', 'cash', 'cash', 'cash', 'cash',
    'transfer', 'transfer', 'qris', 'qris', 'debit', 'credit',
  ];
  const perDayCount = new Map();

  let seq = 0;
  for (let day = 29; day >= 0; day--) {
    // Bengkel lebih ramai di akhir pekan; hari kerja 3-7 transaksi.
    const date = new Date();
    date.setDate(date.getDate() - day);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const n = isWeekend ? int(6, 10) : int(3, 7);

    for (let i = 0; i < n; i++) {
      const createdAt = isoDaysAgo(day, int(8, 19), int(0, 59));
      const customer = rand() < 0.75 ? pick(customers) : null;
      const vehicle =
        customer && rand() < 0.9 && vehiclesByCustomer.get(customer.id)?.length
          ? pick(vehiclesByCustomer.get(customer.id))
          : null;
      const mechanic = rand() < 0.85 ? pick(mechanics) : null;

      // 1-2 jasa + 0-3 sparepart
      const items = [];
      const nService = int(1, 2);
      for (let s = 0; s < nService; s++) {
        const svc = pick(services);
        if (items.some((it) => it.refId === svc.id)) continue;
        const qty = 1;
        const discount = rand() < 0.12 ? roundToThousand(svc.price * 0.1) : 0;
        items.push({
          type: 'service',
          refId: svc.id,
          code: svc.code,
          name: svc.name,
          qty,
          unit: 'Layanan',
          price: svc.price,
          costPrice: 0,
          discount,
          mechanicId: mechanic ? mechanic.id : null,
          subtotal: svc.price * qty - discount,
        });
      }

      const nProd = int(0, 3);
      for (let p = 0; p < nProd; p++) {
        const prod = pick(products);
        if (items.some((it) => it.refId === prod.id)) continue;
        if (prod.stock <= prod.minStock) continue; // jangan bikin stok minus pada data contoh
        const qty = int(1, prod.name.includes('Oli') ? 2 : 1);
        if (qty > prod.stock) continue;
        const discount = rand() < 0.08 ? roundToThousand(prod.sellPrice * 0.05) : 0;
        items.push({
          type: 'product',
          refId: prod.id,
          code: prod.code,
          name: prod.name,
          qty,
          unit: prod.unit,
          price: prod.sellPrice,
          costPrice: prod.costPrice,
          discount,
          mechanicId: mechanic ? mechanic.id : null,
          subtotal: prod.sellPrice * qty - discount,
        });
        // Kurangi stok & catat pergerakan
        db.update('products', prod.id, { stock: prod.stock - qty });
        prod.stock -= qty;
        db.insert('stock_movements', {
          productId: prod.id,
          productName: prod.name,
          type: 'out',
          qty,
          refType: 'transaction',
          refId: null,
          note: 'Penjualan',
          createdAt,
        });
      }

      if (!items.length) continue;

      const subtotal = items.reduce((a, b) => a + b.subtotal, 0);
      const discountTotal = items.reduce((a, b) => a + b.discount, 0);
      const method = pick(methods);
      const total = roundToThousand(subtotal);
      const paidAmount =
        method === 'cash'
          ? Math.max(total, roundToThousand((total + int(0, 3) * 20000) / 1000) * 1000)
          : method === 'credit'
            ? 0
            : total;

      // Sebagian piutang (kredit) sudah dilunasi kemudian
      const creditSettled = method === 'credit' ? rand() < 0.65 : true;

      const d = new Date(createdAt);
      const dayKey = `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
      const seqInDay = (perDayCount.get(dayKey) || 0) + 1;
      perDayCount.set(dayKey, seqInDay);
      seq += 1;

      const trxId = uid('trx');
      db.insert('transactions', {
        id: trxId,
        code: `TRX-${dayKey.replace(/-/g, '')}-${pad(seqInDay, 3)}`,
        date: createdAt,
        customerId: customer ? customer.id : null,
        customerName: customer ? customer.name : 'Pelanggan Umum',
        vehicleId: vehicle ? vehicle.id : null,
        plateNumber: vehicle ? vehicle.plateNumber : '',
        vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model}` : '',
        items,
        subtotal,
        discountTotal,
        taxEnabled: false,
        taxPercent: 0,
        taxAmount: 0,
        total,
        paymentMethod: method,
        creditSettled,
        paidAmount,
        changeAmount: Math.max(0, paidAmount - total),
        status: 'paid',
        note: '',
        userId: pick(kasirUsers),
        workOrderId: null,
        createdAt,
      });

      for (const it of items) {
        if (it.type === 'product') it.refId;
      }
      // simpan userName untuk tampilan riwayat
      const trx = db.byId('transactions', trxId);
      db.update('transactions', trxId, {
        userName: kasirNames.get(trx.userId) || '',
        createdAt,
      });
    }
  }

  // ---- Work order (SPK) contoh ----
  const woStatuses = [
    'menunggu',
    'dikerjakan',
    'dikerjakan',
    'selesai',
    'selesai',
    'diambil',
  ];
  const complaints = [
    'Mesin brebet dan sering mati saat langsir',
    'Rem belakang berbunyi saat ditekan',
    'Oli cepat habis, ada rembesan di blok mesin',
    'AC mobil kurang dingin',
    'Setir bergetar di kecepatan 60 km/jam',
    'Aki cepat tekor, stater berat',
    'Ban belakang bocor halus',
    'Ganti oli berkala + cek kampas rem',
    'Lampu utama redup sebelah',
    'Tarikan berat, CVT selip',
  ];

  let woSeq = 0;
  for (let i = 0; i < 11; i++) {
    const customer = pick(customers);
    const vehicle = pick(vehiclesByCustomer.get(customer.id) || []);
    if (!vehicle) continue;
    const mechanic = pick(mechanics);
    const status = pick(woStatuses);
    const createdAt = isoDaysAgo(int(0, 6), int(8, 17), int(0, 59));
    const srv = pick(services);
    woSeq += 1;

    db.insert('work_orders', {
      code: `SPK-${pad(woSeq, 4)}`,
      date: createdAt,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      vehicleLabel: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
      complaint: complaints[i % complaints.length],
      diagnosis: status === 'menunggu' ? '' : pick(['Perlu penggantian komponen', 'Perlu servis berkala', 'Pembersihan + setel ulang']),
      mechanicId: mechanic.id,
      mechanicName: mechanic.name,
      odometer: int(8000, 78000),
      status,
      estimatedCost: srv.price,
      queueNumber: woSeq,
      items: [{ type: 'service', refId: srv.id, code: srv.code, name: srv.name, qty: 1, unit: 'Layanan', price: srv.price, costPrice: 0, discount: 0 }],
      note: '',
      transactionId: null,
      createdAt,
    });
  }

  // ---- Pengeluaran ----
  for (const [name, category, amount, daysAgo] of EXPENSES) {
    db.insert('expenses', {
      date: isoDaysAgo(daysAgo, int(10, 18)),
      name,
      category,
      amount,
      note: '',
      userId: ownerId,
    });
  }

  return {
    products: products.length,
    services: services.length,
    serviceCategories: serviceCategories.length,
    customers: customers.length,
    vehicles: vehicles.length,
    mechanics: mechanics.length,
    transactions: db.count('transactions'),
    workOrders: db.count('work_orders'),
    expenses: db.count('expenses'),
  };
}

// ------------------------------------------------------------------ main ---

if (RESET && fs.existsSync(DATA_DIR)) {
  // Amankan dulu sebelum menghapus
  try {
    backup({ label: 'before-reset' });
  } catch (_) {
    /* ignore */
  }
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (f === 'backups') continue;
    fs.rmSync(path.join(DATA_DIR, f), { recursive: true, force: true });
  }
  console.log('[seed] Data lama dihapus (backup tersimpan di data/backups).');
}

const alreadySeeded = (() => {
  try {
    load();
    return db.count('users') > 0;
  } catch (_) {
    return false;
  }
})();

if (alreadySeeded && !RESET) {
  console.log('[seed] Data sudah ada, dilewati. Gunakan `npm run reset` untuk mengisi ulang.');
} else {
  const result = seedAll();
  console.log('[seed] Data awal berhasil dibuat:');
  for (const [k, v] of Object.entries(result)) console.log(`  - ${k}: ${v}`);
  console.log('\nAkun login:');
  console.log('  owner / owner123  (akses penuh)');
  console.log('  kasir / kasir123  (transaksi saja)');
}
