# 📖 Dokumentasi Aplikasi — Kasir Pintar Bengkel

Dokumen ini menjelaskan **tampilan dan fitur tiap halaman**, teknologi yang dipakai,
serta **bagaimana perangkat keras** (printer thermal, laci uang, scanner, dll.)
akan tersambung ke aplikasi.

---

## Daftar isi

1. [Teknologi yang dipakai](#1-teknologi-yang-dipakai)
2. [Alur kerja sehari-hari](#2-alur-kerja-sehari-hari)
3. [Penjelasan tiap halaman (12 halaman)](#3-penjelasan-tiap-halaman)
4. [Perangkat keras: peta integrasi](#4-perangkat-keras-peta-integrasi)
5. [Rencana pengembangan bertahap](#5-rencana-pengembangan-bertahap)

---

## 1. Teknologi yang dipakai

| Lapisan | Teknologi | Alasan |
|---|---|---|
| Antarmuka | **React 18 + TypeScript + Vite 6** | Cepat, komponen mudah dirawat |
| Gaya/tampilan | **Tailwind CSS v4** | Konsisten & ringkas, tanpa berkas CSS besar |
| Ikon | SVG inline buatan sendiri (`src/components/icons.tsx`) | Tidak perlu library, tetap tampil walau offline |
| Grafik | SVG buatan sendiri (`src/components/Chart.tsx`) | Tanpa library grafik → ukuran aplikasi kecil |
| Backend | **Express 4 (Node.js)** | Ringan, berjalan sebagai servis lokal di laptop |
| Penyimpanan | **Berkas JSON di folder `data/`** | Tanpa database server, tanpa native module |
| Keamanan | **scrypt** (bawaan Node) + cookie `httpOnly` | Tanpa dependency tambahan |
| Cetak | CSS `@media print` + struk HTML/CSS | Jalan di semua printer Windows |

> **Tidak ada native module** — `npm install` di Windows tidak butuh Visual Studio Build Tools.

**Cara kerja singkat:** backend Express menyajikan API *sekaligus* berkas antarmuka
di alamat `http://localhost:3001`. Browser hanya berbicara ke API; semua akses ke
berkas data dan (nanti) ke perangkat keras dilakukan oleh **backend**, karena browser
tidak boleh mengakses USB/serial secara langsung.

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Chrome/Edge)  ──►  http://localhost:3001              │
│  React + Tailwind            │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │  HTTP (fetch JSON)
┌──────────────────────────────▼──────────────────────────────────┐
│  Backend Express (jalan di laptop yang sama)                    │
│  ├─ /api/auth        login, sesi, ganti password                │
│  ├─ /api/products    sparepart & stok                           │
│  ├─ /api/services    jasa servis                                │
│  ├─ /api/customers   pelanggan & kendaraan                      │
│  ├─ /api/transactions kasir, riwayat, void, pelunasan           │
│  ├─ /api/work-orders SPK servis                                 │
│  ├─ /api/expenses    pengeluaran                                │
│  ├─ /api/reports     dashboard & laporan                        │
│  └─ /api/settings    pengaturan, pengguna, backup               │
│         │                                                       │
│         ▼                                                       │
│   folder data/*.json   ◄──►   (rencana) printer, laci, scanner   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Alur kerja sehari-hari

| Waktu | Pelaku | Halaman yang dipakai |
|---|---|---|
| Buka toko | Owner | **Dashboard** (lihat omzet kemarin, stok menipis) |
| Kendaraan datang | Kasir | **Work Order** → buat SPK, catat keluhan |
| Servis selesai | Kasir | **Work Order** → *Proses ke Kasir* (otomatis pindah ke Kasir) |
| Pembayaran | Kasir | **Kasir** → item, diskon, bayar, **cetak struk**, laci terbuka |
| Ada barang habis | Owner | **Sparepart** → penyesuaian stok / catat pembelian |
| Tutup toko | Owner | **Laporan** + **Pengeluaran** → lihat laba bersih hari ini |
| Akhir bulan | Owner | **Pengaturan → Data & Backup** → tombol Backup |

---

## 3. Penjelasan tiap halaman

### 3.0 Login

**Tujuan:** verifikasi pengguna & menentukan hak akses.
**Akses:** siapa saja yang belum login.

```
┌───────────────────────────────┬───────────────────────────────┐
│▓▓▓ panel gelap + gradasi ▓▓▓  │                               │
│                               │   Masuk ke aplikasi            │
│  🔧  Kasir Pintar Bengkel     │   Gunakan akun yang sudah      │
│      Aplikasi kasir &         │   dibuat pemilik bengkel.      │
│      manajemen bengkel        │                               │
│                               │   Username *                   │
│  Kelola transaksi, stok       │   ┌─────────────────────────┐  │
│  sparepart, dan servis        │   │ owner                   │  │
│  bengkel dalam satu aplikasi. │   └─────────────────────────┘  │
│                               │                               │
│  ✓  Kasir cepat dengan        │   Password *                   │
│     pencarian sparepart       │   ┌─────────────────────────┐  │
│  ✓  Work order / SPK          │   │ ••••••••             👁 │  │
│  ✓  Peringatan stok menipis   │   └─────────────────────────┘  │
│  ✓  Laporan omzet & laba      │                               │
│  ✓  Data tersimpan di laptop  │   ┌─────────────────────────┐  │
│                               │   │         MASUK           │  │
│  Bengkel Pintar Sidoarjo ·    │   └─────────────────────────┘  │
│  Berjalan offline di komputer │                               │
│                               │   ┌─ Akun bawaan (demo) ─────┐ │
│                               │   │ owner / owner123 — penuh │ │
│                               │   │ kasir / kasir123 — kasir │ │
│                               │   └─────────────────────────┘ │
└───────────────────────────────┴───────────────────────────────┘
```

**Fitur**
- Panel kiri: branding + daftar keunggulan (hilang otomatis di layar kecil)
- Tombol 👁 untuk melihat/menyembunyikan password
- Pesan galat inline (username/password salah, akun nonaktif)
- Setelah login, langsung diarahkan ke halaman yang dituju sebelumnya
- Sesi tersimpan 30 hari (cookie `httpOnly`) — tidak perlu login ulang tiap hari

**API:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
**Perangkat keras:** —

---

### 3.1 Dashboard

**Tujuan:** gambaran kondisi bengkel hari ini dalam satu layar.
**Akses:** owner & kasir (isi menyesuaikan role).

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ SIDEBAR  │ ┌──────────────┐┌──────────────┐┌──────────────┐┌──────────┐ │
│          │ │Omzet hari ini││Laba hari ini ││Work order    ││Piutang   │ │
│▸Dashboard│ │💰            ││📈            ││aktif         ││belum lunas│ │
│ Kasir ★  │ │Rp 715.000    ││Rp 630.000    ││📋 3          ││👛 7,1 jt │ │
│ Work     │ │6 transaksi   ││dikurangi     ││5 siap diambil││25 bon    │ │
│  Order   │ │              ││modal         ││              ││          │ │
│ Riwayat  │ └──────────────┘└──────────────┘└──────────────┘└──────────┘ │
│──────────│ ┌────────────────────────────────────┐┌────────────────────┐ │
│ Sparepart│ │ Omzet & laba 30 hari terakhir       ││ Ringkasan bulan ini│ │
│ Jasa     │ │        ╭──╮      ╭─╮   ╭──╮         ││ Omzet      10,09jt│ │
│ Pelanggan│ │   ╭────╯  ╰──╮╭──╯ ╰─╮╭─╯  ╰╮       ││ Transaksi       48│ │
│ Mekanik  │ │ ╭─╯          ╰╯      ╰╯     ╰──╮    ││ Laba kotor  8,10jt│ │
│──────────│ │ ╰──────────────────────────────╯    ││ Pengeluaran 1,07jt│ │
│Pengeluaran│ │  ▓ omzet   ▓ laba (khusus owner)   ││ Laba bersih 7,03jt│ │
│ Laporan  │ └────────────────────────────────────┘└────────────────────┘ │
│Pengaturan│ ┌────────────────────────────────────┐┌────────────────────┐ │
│          │ │ Stok menipis              [Kelola] ││ (kartu stok lanjt.)│ │
│ 👤 Owner │ │ ⚠  Oli Gardan 120ml      8 Botol   ││                    │ │
│ Pemilik  │ │ ⚠  Busi NGK C7HSA       12 Pcs     ││                    │ │
│ Keluar   │ ├────────────────────────────────────┘└────────────────────┘ │
│          │ │ Transaksi terakhir                       [Semua riwayat]  │ │
│          │ │ TRX-…004 │ Hari ini, 22:49 │ Pelanggan Umum │    Rp 30.000│ │
│          │ │ TRX-…003 │ Hari ini, 22:29 │ Andi Kurniawan │   Rp 271.000│ │
│          │ │ TRX-…001 │ Hari ini, 19:31 │ Maya Sari      │   Rp 275.000│ │
│          │ └───────────────────────────────────────────────────────────┘ │
│          │      Nilai stok gudang: Rp 19.342.000 · 30 jenis sparepart     │
└──────────┴──────────────────────────────────────────────────────────────┘
```

**Fitur**
- **4 kartu statistik** — omzet hari ini, laba hari ini (owner) *atau* servis berjalan (kasir), SPK aktif, piutang
- **Grafik area 30 hari** — omzet (biru) vs laba (hijau); **laba otomatis disembunyikan untuk kasir**
- **Ringkasan bulan ini** — omzet, jumlah transaksi, laba kotor, pengeluaran, laba bersih
- **Stok menipis** — 8 barang dengan stok ≤ batas minimum, klik untuk lanjut ke halaman Sparepart
- **Transaksi terakhir** — 8 transaksi terbaru dengan metode bayar & total
- Footer: nilai stok gudang & jumlah jenis sparepart (owner)

**API:** `GET /api/reports/summary`, `GET /api/reports/revenue-series?days=30`
**Perangkat keras:** — (nanti: bisa ditambahkan indikator status printer/laci)

---

### 3.2 Kasir (Point of Sale) ★ halaman utama

**Tujuan:** melayani transaksi secepat mungkin.
**Akses:** owner & kasir.

```
┌─────────────────────────────────────────────┬──────────────────────────┐
│ [Semua│Sparepart│Jasa]  🔍 cari sparepart… ⟳│ ┌────────────────────────┐│
│ (Semua kategori)(Oli & Pelumas)(Rem)(Ban)   │ │ Pelanggan Umum  [Pilih]││
├─────────────────────────────────────────────┤ │ Tanpa data kendaraan   ││
│ ┌──────────────────┐ ┌──────────────────┐   │ ├────────────────────────┤│
│ │📦 Oli Mesin      │ │🔧 Servis Ringan  │   │ │ Keranjang    2 item │🗑││
│ │   Yamalube 0,8L  │ │   Motor          │   │ │────────────────────────││
│ │   SP-001         │ │   JS-002         │   │ │ Oli Shell 10W-40      ││
│ │   Oli & Pelumas  │ │   Servis Berkala │   │ │ Rp 75.000 · stok 34   ││
│ │   Rp 55.000      │ │   Rp 55.000      │   │ │ [−]  2  [+]   Rp150rb ││
│ │   [stok 46 Botol]│ │   45 menit       │   │ │ 👤 Pilih mekanik    ▾ ││
│ └──────────────────┘ └──────────────────┘   │ │────────────────────────││
│ ┌──────────────────┐ ┌──────────────────┐   │ │ Ganti Oli Motor       ││
│ │📦 Busi NGK C7HSA │ │🔧 Servis CVT     │   │ │ Rp 25.000             ││
│ │   SP-005 · Mesin │ │   JS-005         │   │ │ [−]  1  [+]    Rp 25rb││
│ │   Rp 20.000      │ │   Rp 85.000      │   │ ├────────────────────────┤│
│ │   [stok 60 Pcs]  │ │   60 menit       │   │ │ Subtotal      175.000 ││
│ └──────────────────┘ └──────────────────┘   │ │ Diskon              0 ││
│ ┌──────────────────┐ ┌──────────────────┐   │ │ TOTAL         Rp175.000││
│ │📦 Kampas Rem     │ │🔧 Cuci Motor     │   │ ├────────────────────────┤│
│ │   Vario 125      │ │   Premium + Wax  │   │ │ [Tunai✔][Transfer]    ││
│ │   SP-011 · Rem   │ │   JS-019         │   │ │ [QRIS][Debit][Bon]    ││
│ │   Rp 75.000      │ │   Rp 40.000      │   │ │                        ││
│ │   [stok 22 Set]  │ │   60 menit       │   │ │ Uang diterima          ││
│ └──────────────────┘ └──────────────────┘   │ │ ┌────────────────────┐ ││
│        ↕ scroll (maks. 60 item)             │ │ │Rp 200.000          │ ││
│                                             │ │ └────────────────────┘ ││
│                                             │ │ 175rb 100rb [Bulatkan] ││
│                                             │ │ ┌────────────────────┐ ││
│                                             │ │ │Kembalian   25.000  │ ││
│                                             │ │ └────────────────────┘ ││
│                                             │ │ Diskon [      ]        ││
│                                             │ │ Mekanik [Samsul ▾]     ││
│                                             │ │ ☑ Kenakan PPN 11%      ││
│                                             │ │ Catatan…               ││
│                                             │ │ ┌──────┐┌────────────┐││
│                                             │ │ │Simpan││Bayar & Cetak││
│                                             │ │ └──────┘└────────────┘││
└─────────────────────────────────────────────┴──────────────────────────┘
```

**Fitur katalog (kiri)**
- Tab **Semua / Sparepart / Jasa Servis**
- Pencarian **langsung saat mengetik** (nama, kode, barcode, kategori)
- Chip kategori untuk mempersempit
- Kartu item menampilkan: kode, kategori, harga, badge stok (merah jika habis, kuning jika < 5)
- Item dengan stok 0 otomatis **tidak bisa diklik**

**Fitur keranjang (kanan)**
- Pilih pelanggan terdaftar **atau** "Pelanggan Umum" tanpa mendaftar
- Pilih kendaraan (nomor polisi) bila pelanggan punya
- Atur qty dengan tombol **− / +** (dibatasi oleh stok)
- **Ubah harga & diskon per item — khusus owner** (kasir hanya melihat subtotal)
- **Pilih mekanik per item jasa** → menentukan komisi
- Diskon transaksi, PPN opsional, catatan

**Fitur pembayaran**
- 5 metode: Tunai, Transfer, QRIS, Kartu Debit, Kredit/Bon
- Untuk **Tunai**: input uang diterima + tombol cepat (nominal & "Bulatkan") + kembalian besar berwarna hijau
- Untuk **Bon**: otomatis tercatat sebagai piutang
- Validasi: uang kurang → tombol Simpan diblokir

**Fitur penyimpanan**
- **Simpan** → transaksi tersimpan, keranjang dikosongkan
- **Bayar & Cetak** → tersimpan + struk langsung muncul & dialog cetak terbuka
- Stok sparepart **langsung berkurang** dan tercatat di riwayat pergerakan stok

**API:** `GET /api/products`, `GET /api/services`, `GET /api/mechanics`,
`GET /api/customers`, `POST /api/transactions`

**Perangkat keras**
| Perangkat | Peran di halaman ini | Status |
|---|---|---|
| 🔦 **Barcode scanner** | Hasil scan masuk ke kolom pencarian (mode keyboard) | ✅ Sudah bisa dipakai sekarang |
| 🖨 **Printer thermal** | Cetak struk otomatis setelah "Bayar & Cetak" | ⚠️ Lewat dialog browser |
| 💰 **Laci uang** | Terbuka otomatis saat transaksi Tunai | 🔜 Rencana (Tahap 1) |
| 🖥 **Tampilan pelanggan** | Menampilkan item & total ke arah pelanggan | 🔜 Rencana (Tahap 2) |

---

### 3.3 Work Order / SPK

**Tujuan:** mencatat & memantau antrean servis.
**Akses:** owner & kasir.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐                         │
│ │Menunggu 1││Dikerjakan││ Selesai 5││ Diambil  │      ← kartu = filter   │
│ │   ⏱      ││    2     ││    ✔     ││    🚗    │                         │
│ └──────────┘└──────────┘└──────────┘└──────────┘                         │
├──────────────────────────────────────────────────────────────────────────┤
│ [Semua│Menunggu│Dikerjakan│Selesai│Diambil]  🔍 cari SPK…   [+ Buat WO]  │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐  │
│ │ SPK-0004            │ │ SPK-0007            │ │ SPK-0011            │  │
│ │ W 2468 EF  [Dikerjakan]│ W 1122 MN [Selesai] │ │ W 9900 UV [Menunggu]│  │
│ │ Siti Rahayu         │ │ Dedi Prasetyo       │ │ Wulan Anggraini     │  │
│ │ Yamaha Mio M3 (2020)│ │ Kijang Innova 2016  │ │ Honda PCX 160 2022  │  │
│ │ 24.500 km           │ │ 67.300 km           │ │ 12.100 km           │  │
│ │ ┌─────────────────┐ │ │ ┌─────────────────┐ │ │ ┌─────────────────┐ │  │
│ │ │Rem belakang     │ │ │ │AC mobil kurang  │ │ │ │Tarikan berat,   │ │  │
│ │ │berbunyi saat    │ │ │ │dingin           │ │ │ │CVT selip        │ │  │
│ │ │ditekan          │ │ │ └─────────────────┘ │ │ └─────────────────┘ │  │
│ │ └─────────────────┘ │ │ 👤 Budi Santoso     │ │ 👤 — belum ada —    │  │
│ │ 👤 Samsul Hadi      │ │         Rp 250.000  │ │         Rp 85.000   │  │
│ │         Rp 40.000   │ │ 2 hari lalu, 09:20  │ │ Hari ini, 08:15     │  │
│ │ 3 hari lalu, 14:07  │ ├─────────────────────┤ ├─────────────────────┤  │
│ ├─────────────────────┤ │ [Detail][Selesai]   │ │ [Detail][Mulai]     │  │
│ │ [Detail][Selesai]   │ │ [Ke Kasir →]        │ │ [Ke Kasir →]        │  │
│ │ [Ke Kasir →]        │ │                     │ │                     │  │
│ └─────────────────────┘ └─────────────────────┘ └─────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Fitur**
- **4 kartu status** sekaligus berfungsi sebagai filter cepat
- Kartu SPK: kode, plat, pelanggan, kendaraan, odometer, keluhan, mekanik, estimasi biaya, waktu relatif
- **Tombol alur status satu klik**: Menunggu → *Mulai* → Dikerjakan → *Selesai* → Selesai → *Sudah diambil*
- **"Ke Kasir"** — membuka halaman Kasir dengan item pekerjaan, pelanggan, dan kendaraan **sudah terisi**
- Setelah transaksi dibuat, SPK otomatis berstatus **Diambil** dan menampilkan kode transaksinya
- Modal detail: keluhan, diagnosis, item pekerjaan, estimasi, tombol ubah/hapus

**API:** `GET /api/work-orders`, `POST /api/work-orders`, `PUT /api/work-orders/:id`,
`POST /api/work-orders/:id/status`, `DELETE /api/work-orders/:id`

**Perangkat keras:** — (opsional: printer untuk cetak tanda terima SPK)

---

### 3.4 Riwayat Transaksi

**Tujuan:** mencari, memeriksa, mencetak ulang, membatalkan, dan melunasi transaksi.
**Akses:** owner & kasir (**Batalkan** hanya owner).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Hari ini│Bulan ini│Semua│Kustom]  🔍 cari kode/pelanggan/plat…          │
│ Pembayaran [Semua ▾]  Status [Semua ▾]                    [⬇ Ekspor CSV] │
├──────────────────────────────────────────────────────────────────────────┤
│ Kode          │Waktu          │Pelanggan      │Item│Pembayaran│Kasir│Total│
│───────────────┼───────────────┼───────────────┼────┼──────────┼─────┼─────│
│ TRX-…004      │Hari ini, 22:49│Pelanggan Umum │ 1  │ Tunai    │Kasir│30rb │
│ TRX-…003      │Hari ini, 22:29│Andi Kurniawan │ 4  │ Tunai    │Owner│271rb│
│               │               │ W 1234 AB     │    │          │     │     │
│ TRX-…001      │Hari ini, 19:31│Maya Sari      │ 2  │[Bon][QRIS]│Kasir│275rb│
│ … baris merah muda = transaksi yang dibatalkan                           │
├──────────────────────────────────────────────────────────────────────────┤
│ Total omzet pada filter ini: Rp 10.090.000                               │
│ 174 data · Halaman 1 dari 7        [Sebelumnya] [Berikutnya]             │
└──────────────────────────────────────────────────────────────────────────┘
```

**Fitur**
- Filter preset tanggal + rentang kustom + pencarian + filter metode & status
- Badge khusus: **[Bon]** (kredit belum lunas), **[Batal]**
- Modal detail berisi rincian item, ringkasan pembayaran, catatan, dan informasi pembatalan
- **Batalkan transaksi** (owner) — stok otomatis **dikembalikan**, alasan dicatat
- **Tandai lunas** untuk transaksi kredit/bon
- **Cetak ulang struk** kapan saja
- **Ekspor CSV** (owner) — langsung bisa dibuka di Excel
- Ringkasan total omzet sesuai filter di bawah tabel

**API:** `GET /api/transactions`, `GET /api/transactions/:id`,
`POST /api/transactions/:id/void`, `POST /api/transactions/:id/settle`,
`GET /api/transactions/export/csv`

**Perangkat keras:** 🖨 printer thermal (cetak ulang struk) · 💰 laci uang

---

### 3.5 — 3.9 Halaman Data Master (pola seragam)

Lima halaman berikut memakai **pola tampilan yang sama**: deretan kartu statistik
di atas, baris alat (pencarian + filter + tombol tambah) di tengah, tabel utama,
lalu **modal form** untuk tambah/ubah.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐         │
│ │(statistik 1) ││(statistik 2) ││(statistik 3) ││(statistik 4) │         │
│ └──────────────┘└──────────────┘└──────────────┘└──────────────┘         │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 cari…            [Filter ▾]  ☑ opsi      [+ Tambah …]             │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ Kolom 1 │ Kolom 2 │ Kolom 3 │ Nilai │ Status │      Aksi             │ │
│ │─────────┼─────────┼─────────┼───────┼────────┼───────────────────────│ │
│ │ …       │ …       │ …       │ …     │ …      │ [Ubah][🗑][🕘]        │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ 30 data · Halaman 1 dari 2          [Sebelumnya] [Berikutnya]        │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘

   Saat tombol [+ Tambah] diklik → modal form muncul di tengah layar:
   ┌──────────────────────────────────────────┐
   │ Tambah …                             [✕] │
   ├──────────────────────────────────────────┤
   │ Label *   [____________________________] │
   │ Label     [____________]  [___________]  │
   │ ☑ Aktif                                  │
   ├──────────────────────────────────────────┤
   │                    [Batal]  [ Simpan ]   │
   └──────────────────────────────────────────┘
```

#### 3.5 Sparepart & Stok

| Kartu statistik | Isi |
|---|---|
| Jenis sparepart | 30 |
| Stok menipis | 10 (di bawah batas minimum) |
| Stok habis | perlu segera dibeli |
| Nilai stok (modal) | Rp 19.342.000 — **khusus owner** |

Kolom tabel: Kode · Nama (+rak) · Kategori · Stok (merah jika di bawah minimum) ·
Harga Beli (**khusus owner**) · Harga Jual · Aksi.

Aksi per baris:
- 🕘 **Riwayat stok** — daftar pergerakan (masuk/keluar, keterangan, nomor transaksi)
- ⟳ **Penyesuaian stok** — pilih *Barang masuk / Barang keluar / Setel stok (opname)*, isi jumlah & keterangan
- **Ubah** — modal form lengkap
- 🗑 **Hapus** — dengan dialog konfirmasi

Field form: kode (otomatis jika dikosongkan), kategori, nama, satuan, barcode,
harga beli, harga jual, stok awal, batas minimum, lokasi/rak, supplier, catatan, status aktif.

**API:** `GET/POST/PUT/DELETE /api/products`, `POST /api/products/:id/stock`
**Perangkat keras:** 🔦 scanner (isi barcode) · 🖨 printer label (rencana)

#### 3.6 Jasa Servis

Kartu: jumlah jenis jasa · rata-rata harga · total estimasi durasi.
Kolom tabel: Kode · Nama layanan · Kategori · Estimasi durasi · Harga · Aksi (owner).
Panel bawah: **manajemen kategori** (chip dengan tombol hapus + input cepat, saran otomatis dari kategori sparepart).

**API:** `GET/POST/PUT/DELETE /api/services`, `GET/POST/DELETE /api/service-categories`

#### 3.7 Pelanggan & Kendaraan

Kartu: total pelanggan · kendaraan terdaftar · total belanja.
Kolom tabel: Nama (+alamat) · Kontak · Jumlah kendaraan · Jumlah transaksi · Total belanja · Terakhir servis · Aksi.

Modal detail berisi:
- 3 mini-statistik (transaksi, total belanja, terakhir servis)
- **Daftar kendaraan** — tambah/ubah/hapus (plat, merek, model, tahun, jenis Motor/Mobil)
- **Riwayat transaksi** pelanggan tersebut

**API:** `GET/POST/PUT/DELETE /api/customers`, `GET /api/customers/:id`,
`POST /api/customers/:id/vehicles`, `PUT/DELETE /api/customers/vehicles/:vehicleId`

#### 3.8 Mekanik (owner)

Kartu: jumlah mekanik · total omzet dari mekanik (bulan berjalan) · total estimasi komisi.
Kolom tabel: Nama · Kontak · **Bagi hasil %** · Jumlah pekerjaan · Omzet · **Estimasi komisi** · Status · Aksi.

Angka komisi dihitung otomatis dari item jasa/sparepart yang ditandai dikerjakan mekanik tersebut.

**API:** `GET/POST/PUT/DELETE /api/mechanics`, `GET /api/reports/mechanics`

#### 3.9 Pengeluaran

Filter periode (Bulan ini / Semua / Kustom) + tombol Ekspor CSV + tombol Catat Pengeluaran.
Kolom tabel: Tanggal · Keterangan · Kategori · Dicatat oleh · Jumlah (merah) · Aksi.
Panel bawah: **rincian per kategori** + total periode.

Kategori bawaan: Gaji, Listrik & Air, Sewa, Perlengkapan, Peralatan, Perawatan Alat, Konsumsi, Utilitas, Lainnya.

**API:** `GET/POST/PUT/DELETE /api/expenses`, `GET /api/expenses/export/csv`

---

### 3.10 Laporan

**Tujuan:** analisis keuangan & performa. **Akses: owner** (kasir melihat versi tanpa laba).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Hari ini│7 hari│30 hari│Bulan ini│Bulan lalu│Kustom]  Jenis [Semua ▾]   │
│                                                            [⬇ Ekspor CSV]│
│ Periode: 10 Sep 2026 s/d 09 Okt 2026                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐            │
│ │ Omzet  ││Rata²   ││Laba    ││Komisi  ││Pengel. ││Laba    │            │
│ │ 💰     ││transaksi│kotor  ││mekanik ││        ││bersih  │            │
│ │44,8 jt ││ 358 rb ││26,4 jt ││ 5,7 jt ││ 3,8 jt ││22,5 jt │            │
│ └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘            │
├────────────────────────────────────────┬─────────────────────────────────┤
│ Tren omzet harian                      │ Komposisi pembayaran            │
│      ╭─╮    ╭──╮      ╭╮               │         ╭─────────╮             │
│  ╭───╯ ╰────╯  ╰──╮ ╭─╯╰──╮            │      ╭──╯ Tunai   ╰╮   Total    │
│ ╭╯                ╰─╯     ╰──╮         │   ╭──╯   62%       ╰╮  44,8jt  │
│ ╰───────────────────────────╯         │   ╰─────────────────╯           │
│  ▓ omzet  ▓ laba kotor                │   ●Tunai 62% ●QRIS 18%          │
├────────────────────────────────────────┴─────────────────────────────────┤
│ Perbandingan 12 bulan                                                     │
│  ▌  ▌ ▌  ▌   ▌  ▌    ▌   ▌  ▌   ▌      ▌   ▌   ▌  ▌                     │
│  Agu Sep Okt Nov Des Jan Feb Mar Apr Mei Jun Jul Agu Sep                  │
│  ▓ Omzet   ▓ Laba bersih                                                 │
├──────────────────────┬──────────────────────┬────────────────────────────┤
│ Item terlaris        │ Kinerja mekanik      │ Omzet per kategori         │
│ Bongkar Mesin  4,1jt │ Budi Santoso  14,3jt │ ███████ Servis Mesin       │
│ Ban Mobil      3,5jt │ 122 job · 5,7jt      │ █████ Oli & Pelumas        │
│ Oli Mobil 10W- 2,9jt │ Samsul Hadi   13,3jt │ ████ Rem & Kaki-kaki       │
│ …                    │ 125 job · 6,0jt      │ ██ Kelistrikan             │
└──────────────────────┴──────────────────────┴────────────────────────────┘
```

**Fitur**
- **6 preset periode** + rentang kustom + filter jenis item (Semua/Sparepart/Jasa)
- **6 kartu laba rugi**: omzet → rata-rata transaksi → laba kotor (dikurangi modal) → komisi mekanik → pengeluaran → **laba bersih**
- **Grafik area** tren omzet & laba harian
- **Grafik donat** komposisi metode pembayaran
- **Grafik batang** perbandingan omzet vs laba bersih 12 bulan
- **Tiga panel peringkat**: item terlaris, kinerja mekanik, omzet per kategori
- Untuk **kasir**: kartu laba diganti (item terjual, metode favorit, kategori terlaris, mekanik terbaik) + catatan penjelasan

**API:** `GET /api/reports/profit-loss`, `/revenue-series`, `/monthly`, `/top-items`,
`/mechanics`, `/payments`, `/categories`

**Perangkat keras:** 🖨 printer A4 (bila ingin cetak laporan) — rencana Tahap 4

---

### 3.11 Pengaturan

**Akses: owner** (4 tab).

**Tab 1 — Profil Bengkel**
```
┌────────────────────────────────────────┬─────────────────────────┐
│ Identitas bengkel            [Simpan]  │ Pratinjau struk         │
│ Nama bengkel *                         │ ┌─────────────────────┐ │
│ [Bengkel Pintar Sidoarjo            ]  │ │  BENGKEL PINTAR     │ │
│ Slogan / tagline                       │ │  SIDOARJO           │ │
│ [Servis Motor & Mobil Bergaransi    ]  │ │  Jl. Raya Sidoarjo  │ │
│ Alamat                                 │ │  0811-2233-4455     │ │
│ [Jl. Raya Sidoarjo No. 88 …         ]  │ │ --------------------│ │
│ Telepon      [0811-2233-4455        ]  │ │ TRX-001   09/10 22:5│ │
│ Catatan kaki struk                     │ │ Pelanggan: Contoh   │ │
│ [Barang yang sudah dibeli …         ]  │ │ --------------------│ │
├────────────────────────────────────────┤ │ Ganti Oli Motor 25rb│ │
│ Transaksi & struk            [Simpan]  │ │ Oli Mesin 0,8L  55rb│ │
│ Lebar kertas struk  [58 mm ▾]          │ │ --------------------│ │
│ Persentase PPN (%)  [11]               │ │ TOTAL          80rb │ │
│ ☑ Aktifkan PPN bawaan di Kasir         │ │ Tunai         100rb │ │
│ ☑ Langsung buka dialog cetak           │ │ Kembali        20rb │ │
│ ☑ Tampilkan peringatan stok menipis    │ │ --------------------│ │
│                                        │ │  Terima kasih       │ │
│                                        │ └─────────────────────┘ │
└────────────────────────────────────────┴─────────────────────────┘
```
**Pratinjau struk langsung berubah** saat Anda mengetik — jadi tidak perlu cetak dulu untuk menguji.

**Tab 2 — Pengguna**
Tabel akun: Nama · Username · Role · Status · Dibuat · Aksi.
Modal form: nama, username, role (Kasir/Owner), password (kosongkan bila tidak diubah), status aktif.
Sistem **mencegah** penonaktifan/penurunan role owner terakhir dan penghapusan akun yang sedang dipakai.

**Tab 3 — Data & Backup**
- Lokasi folder data + ukuran tiap berkas JSON
- Tombol **Buat Backup Sekarang** · **Pilih Berkas** (pulihkan)
- Daftar backup tersimpan dengan tombol **Unduh** & **Pulihkan**

**Tab 4 — Tentang**
Informasi versi, cara menjalankan di Windows, dan tips penggunaan.

**API:** `GET/PUT /api/settings`, `GET/POST/PUT/DELETE /api/users`,
`GET/POST /api/settings/backups`, `GET /api/settings/backups/:name/download`,
`POST /api/settings/restore`

---

## 4. Perangkat keras: peta integrasi

### 4.1 Yang penting dipahami

Aplikasi ini **berjalan di dalam browser**, tetapi backend-nya (Node.js) **berjalan di
laptop yang sama**. Browser tidak boleh mengakses USB/serial secara langsung, sedangkan
Node.js bisa. Karena itu:

```
┌──────────────────────┐
│ 🔦 Barcode scanner   │──┐
│    mode keyboard HID │  │  ← tidak butuh backend, langsung ke browser
└──────────────────────┘  │
                          ▼
                   ┌───────────────┐
                   │   Browser     │
                   └───────┬───────┘
                           │ HTTP
                   ┌───────▼────────────────────────────────┐
                   │  Backend Express  (di laptop)          │
                   └───┬──────────┬──────────┬──────────────┘
                       │          │          │
              ┌────────▼──┐ ┌────▼─────┐ ┌──▼──────────────┐
              │ Printer   │ │ Laci uang│ │ Serial (COM)    │
              │ thermal   │ │ (via     │ │ display, timbang│
              │ TCP / USB │ │ printer) │ │ an              │
              └───────────┘ └──────────┘ └─────────────────┘
```

Jadi semua perangkat **kecuali scanner** akan diurus oleh backend. Ini juga berarti
perangkatnya tetap bisa dipakai dari HP/tablet lain yang membuka alamat LAN.

---

### 4.2 Yang sudah dibangun

Modul perangkat keras berada di `server/hardware/`:

| Berkas | Isi |
|---|---|
| `escpos.js` | Pembuat perintah ESC/POS murni JavaScript: tebal, ukuran huruf, rata kiri/tengah/kanan, pemotongan baris otomatis, potong kertas, **buka laci**, bunyi buzzer |
| `printer.js` | Empat jalur kirim: **driver Windows**, **jaringan (TCP)**, **serial COM**, dan **berkas** (diagnostik). Termasuk daftar printer, tes koneksi, pole display, dan timbangan |
| `scripts/*.ps1` | Skrip PowerShell bawaan Windows untuk mencetak mentah & membaca/menulis port serial |

Rute API yang tersedia:

| Endpoint | Fungsi |
|---|---|
| `GET /api/hardware/status` | Info sistem, konfigurasi aktif, daftar printer |
| `GET /api/hardware/printers` | Daftar printer yang terpasang |
| `POST /api/hardware/test-connection` | Uji koneksi tanpa mencetak |
| `POST /api/hardware/test-print` | Cetak struk uji coba |
| `POST /api/hardware/open-drawer` | Buka laci uang |
| `POST /api/hardware/print-transaction/:id` | Cetak ulang struk transaksi |
| `POST /api/hardware/display` | Kirim teks 2 baris ke pole display |
| `GET /api/hardware/scale` | Baca berat dari timbangan |
| `PUT /api/hardware/settings` | Simpan pengaturan perangkat |

Antarmukanya ada di **Pengaturan → tab Perangkat**: pilih jenis pencetakan,
pilih printer dari daftar yang terdeteksi, atur jumlah salinan & pin laci,
lalu uji dengan tombol **Tes Koneksi**, **Cetak Struk Uji**, dan **Buka Laci Uang**.

Struk yang dihasilkan sudah diuji: 32 kolom untuk kertas 58 mm dan 48 kolom
untuk 80 mm, auto-wrap, potong kertas, dan perintah buka laci (`ESC p`).

**Tetap tanpa native module** — jaringan memakai TCP bawaan Node, sedangkan
Windows dan serial memakai PowerShell yang sudah ada di sistem.

### 4.3 Matriks perangkat

| Perangkat | Tersambung lewat | Status sekarang | Rencana | Catatan |
|---|---|---|---|---|
| 🔦 **Barcode scanner** | USB / Bluetooth — tampil sebagai **keyboard** | ✅ **Sudah bisa dipakai** — hasil scan langsung masuk keranjang | Sudah tersedia | Pastikan mode **HID / keyboard**, bukan mode COM. Scan = ketik + Enter otomatis |
| 🖨 **Printer thermal 58/80mm** | USB, LAN, atau serial | ✅ **Cetak langsung tanpa dialog** — 4 jalur kirim tersedia | Sudah tersedia | Atur di Pengaturan → Perangkat |
| 💰 **Laci uang** | Kabel RJ11 → **ke printer** | ✅ **Terbuka otomatis** saat pembayaran Tunai | Sudah tersedia | Pin 2 atau pin 5 bisa dipilih |
| 🖥 **Monitor kedua / tampilan pelanggan** | HDMI | ❌ Belum | Halaman khusus `/display` | Murni frontend, paling mudah |
| 📟 **Pole display (customer display)** | USB → port COM | ✅ Endpoint tersedia (`/api/hardware/display`) | Sudah tersedia | Banyak merek murah memakai protokol ESC/POS atau CD5220 |
| ⚖️ **Timbangan digital** | Serial COM / USB | ✅ Endpoint tersedia (`/api/hardware/scale`) | Sudah tersedia | Opsional, jarang dipakai bengkel |
| 💳 **Mesin EDC / QRIS** | Berdiri sendiri | ⚠️ Dicatat manual | Tetap manual | Integrasi EDC butuh kerja sama bank/acquirer |
| 🏷 **Printer label barcode** | USB | ❌ Belum | Cetak label rak/barang | Bisa lewat backend |
| 🔌 **UPS** | Stop kontak | ✅ Data sudah aman (atomic write) | Tetap disarankan | Mencegah mati mendadak saat transaksi |

---

### 4.4 Rencana teknis per perangkat

**Printer thermal — cetak langsung (tanpa dialog)**
- Modul baru `server/hardware/printer.js` pembuat perintah **ESC/POS**:
  format teks, logo, potong kertas, dan buka laci
- Tiga jalur kirim yang akan disediakan:
  1. **Jaringan (LAN/Wi-Fi, port 9100)** — murni Node.js, tanpa driver, tanpa native module
  2. **USB di Windows** — lewat skrip **PowerShell** bawaan Windows (tetap tanpa native module)
  3. **Serial COM** — untuk printer lama
- Pengaturan baru di menu Pengaturan: pilih printer, lebar kertas, potong otomatis,
  jumlah salinan, **buka laci otomatis saat metode Tunai**
- Endpoint: `POST /api/hardware/print-test`, `POST /api/hardware/open-drawer`,
  `POST /api/transactions/:id/print`
- Tombol **Cetak Ulang** di Riwayat & **Cetak Tanda Terima** di Work Order

**Barcode scanner — penyempurnaan**
- Kolom pencarian halaman Kasir selalu **fokus otomatis**
- Hasil scan (diakhiri Enter) langsung **menambah item ke keranjang** kalau kodenya unik
- Dukungan konfigurasi *prefix/suffix* bila scanner Anda mengirim karakter tambahan
- Bunyi *beep* singkat saat item berhasil ditambahkan

**Monitor kedua / tampilan pelanggan**
- Halaman baru `/display` (tanpa sidebar, tanpa menu): menampilkan daftar item,
  total, dan kode transaksi yang sedang berjalan
- Dibuka dengan tombol **"Buka Tampilan Pelanggan"** di halaman Kasir (`window.open`)
- Bisa di-drag ke monitor kedua dan di-*fullscreen* (F11)

**Perangkat serial (pole display & timbangan)**
- Modul `server/hardware/serial.js` + helper PowerShell (`[System.IO.Ports.SerialPort]`)
  supaya **tetap tanpa native module**
- Endpoint: `POST /api/hardware/display` (kirim teks 2 baris), `GET /api/hardware/scale` (baca berat)

---

## 5. Rencana pengembangan bertahap

| Tahap | Isi | Dampak | Perangkat |
|---|---|---|---|
| **1** | **Cetak ESC/POS langsung + laci uang + penyempurnaan scanner** | Transaksi jauh lebih cepat, laci terbuka otomatis | 🖨 💰 🔦 |
| **2** | **Tampilan pelanggan (monitor kedua) + pole display** | Pelanggan bisa memantau total | 🖥 📟 |
| **3** | **Shift kasir & tutup buku** (kas awal, setoran, selisih) | Kontrol uang tunai harian | 💰 |
| **4** | **Pembelian supplier & penerimaan barang (PO)** + retur penjualan | Stok bertambah otomatis, HPP lebih akurat | 🔦 🏷 |
| **5** | **Kemasan desktop (Electron)** + cetak laporan A4 | Jalan tanpa browser, shortcut di desktop | — |

**Rekomendasi saya:** mulai **Tahap 1** — dampaknya paling terasa di operasional harian
dan menjadi fondasi untuk perangkat lainnya (laci uang menempel pada printer).

> **Catatan — Tahap 1 sudah dikerjakan.** Status pada tabel di atas sudah diperbarui.
> Yang belum: tampilan pelanggan di monitor kedua (Tahap 2).

---

### Yang saya butuhkan dari Anda

Supaya Tahap 1 bisa langsung cocok dengan peralatan Anda, mohon info:

1. **Merek & tipe printer thermal** Anda (mis. Epson TM-T82, Xprinter XP-58, Rongta, POS-5890)
2. **Tersambung lewat apa** — USB, LAN (RJ45), atau Bluetooth?
3. **Laci uang** — ada atau belum? Kalau ada, colokannya ke printer atau ke komputer?
4. **Barcode scanner** — sudah punya? Tahukah apakah ia mengirim **Enter** setelah scan?
