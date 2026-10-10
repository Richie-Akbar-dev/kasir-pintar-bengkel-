# 🔧 Kasir Pintar Bengkel

Aplikasi kasir (POS) dan manajemen bengkel **motor & mobil** yang berjalan di **laptop Windows**.
Semua data tersimpan **lokal di komputer Anda** — tanpa biaya bulanan, tanpa server cloud, dan tetap bisa dipakai
walau internet sedang mati.

---

## ✨ Fitur utama

### 🧾 Kasir (Point of Sale)
- Pencarian cepat sparepart & jasa servis (nama, kode, barcode)
- Filter kategori, badge stok langsung terlihat
- Keranjang dengan atur jumlah, **ubah harga** (owner), dan diskon per item
- Pilih pelanggan terdaftar **atau** "Pelanggan Umum" tanpa harus mendaftar dulu
- Pilih kendaraan (nomor polisi) & mekanik yang mengerjakan
- Metode bayar: **Tunai, Transfer, QRIS, Kartu Debit, Kredit/Bon**
- Tombol nominal cepat & pembulatan otomatis, hitung kembalian
- Diskon transaksi & opsi PPN
- **Cetak struk thermal 58mm / 80mm** lewat printer bawaan Windows
- Stok sparepart otomatis berkurang saat transaksi disimpan

### 📋 Work Order / SPK (antrean servis)
- Catat keluhan, diagnosis, kilometer, estimasi biaya, dan mekanik
- Status berurutan: **Menunggu → Dikerjakan → Selesai → Diambil**
- Satu klik **"Proses ke Kasir"**: item pekerjaan langsung masuk keranjang kasir
- SPK otomatis ditandai *diambil* ketika transaksi dibuat

### 📦 Inventori sparepart
- Katalog sparepart lengkap dengan kategori, satuan, rak, supplier, barcode
- **Harga beli (modal) & harga jual** — modal hanya terlihat oleh owner
- Peringatan **stok menipis** berdasarkan batas minimum tiap barang
- Penyesuaian stok (barang masuk / keluar / stok opname) dengan riwayat pergerakan

### 🛠️ Jasa servis & mekanik
- Daftar jasa dengan kategori, harga, dan estimasi durasi
- Data mekanik dengan **persentase bagi hasil** → otomatis hitung estimasi komisi

### 👥 Pelanggan & kendaraan
- Data pelanggan + nomor HP + alamat
- Banyak kendaraan per pelanggan (plat, merek, model, tahun)
- Riwayat servis per pelanggan

### 📊 Laporan (khusus owner)
- **Laba rugi**: omzet, HPP/modal, laba kotor, komisi mekanik, pengeluaran, laba bersih
- Tren omzet harian, perbandingan 12 bulan, komposisi metode pembayaran
- Item terlaris, omzet per kategori, kinerja mekanik
- Filter periode (hari ini / 7 hari / 30 hari / bulan ini / bulan lalu / kustom)
- **Ekspor CSV** yang langsung bisa dibuka di Excel

### 💸 Pengeluaran & ⚙️ Pengaturan
- Catat biaya operasional (listrik, gaji, perlengkapan, dll.) per kategori
- Pengaturan identitas bengkel, PPN, lebar kertas struk, pratinjau struk
- **Manajemen pengguna** dengan dua role: `owner` (akses penuh) dan `kasir` (transaksi saja)
- **Backup & restore** data, backup otomatis harian (disimpan 14 versi terakhir)

---

## 🖥️ Persyaratan

| Kebutuhan | Keterangan |
|---|---|
| Sistem operasi | Windows 10 / 11 (bisa juga Linux & macOS) |
| Node.js | v18.18 atau lebih baru — [unduh di nodejs.org](https://nodejs.org) (pilih **LTS**) |
| Browser | Chrome / Edge (untuk membuka antarmuka) |
| Printer | Printer thermal 58mm/80mm (opsional, struk juga bisa disimpan sebagai PDF) |

> Tidak ada database server yang harus dipasang. Data disimpan sebagai berkas JSON di folder `data/`.

---

## 🚀 Cara menjalankan (Windows)

### 1. Pasang Node.js

Unduh versi **LTS** di [nodejs.org](https://nodejs.org), lalu jalankan penginstalnya.
Setelah selesai, **tutup dan buka kembali jendela CMD** agar PATH-nya terbaca.

Cek dengan perintah berikut — harus muncul nomor versi (minimal `v18`):

```bat
node -v
npm -v
```

### 2. Ambil kode aplikasi

Kode berada di **cabang `arena/4405f452-kasir-pintar-bengkel`** (cabang `main` masih kosong).

**Cara A — lewat Git** (jalankan di CMD):

```bat
git clone https://github.com/Richie-Akbar-dev/kasir-pintar-bengkel-.git
cd kasir-pintar-bengkel-
git checkout arena/4405f452-kasir-pintar-bengkel
```

**Cara B — tanpa Git:** unduh ZIP cabang ini, lalu ekstrak:

```
https://github.com/Richie-Akbar-dev/kasir-pintar-bengkel-/archive/refs/heads/arena/4405f452-kasir-pintar-bengkel.zip
```

### 3. Instalasi (cukup sekali)

```bat
install.bat
```

Skrip ini akan mengunduh dependency, membangun antarmuka, dan membuat data contoh.
Tunggu sampai muncul **"INSTALASI SELESAI"**.

### 4. Menjalankan aplikasi

Setiap kali ingin memakai:

```bat
start.bat
```

Browser akan terbuka otomatis ke `http://localhost:3001`.

> ⚠️ **Jangan tutup jendela CMD selama aplikasi dipakai.**
> Menutupnya akan menghentikan server. Untuk berhenti dengan rapi, tekan **Ctrl+C**.

### Akun bawaan

| Username | Password | Hak akses |
|---|---|---|
| `owner` | `owner123` | Semua fitur, termasuk laba, modal, pengeluaran, dan pengaturan |
| `kasir` | `kasir123` | Kasir, work order, riwayat, pelanggan — tanpa angka laba/modal |

> ⚠️ Ganti password bawaan di menu **Pengaturan → Pengguna** setelah instalasi.

### Berkas `.bat`

| Berkas | Fungsi |
|---|---|
| `install.bat` | Instalasi pertama kali (npm install + build + data contoh) |
| `start.bat` | Menjalankan aplikasi & membuka browser |
| `reset-data.bat` | Mengembalikan data ke contoh awal (data lama tetap dibackup) |

---

## 💾 Menyimpan & memindahkan data

- Semua data ada di folder **`data/`** (`products.json`, `transactions.json`, dst.).
- **Backup**: salin folder `data/` ke flashdisk/OneDrive, atau gunakan menu
  **Pengaturan → Data & Backup → Buat Backup Sekarang**.
- **Pindah komputer**: pasang aplikasi di komputer baru, lalu salin folder `data/` dari komputer lama,
  atau pakai tombol *Pulihkan* di tab **Data & Backup**.
- Backup otomatis harian tersimpan di `data/backups/` (maksimal 14 versi terakhir).
- Lokasi folder data bisa dipindah dengan environment variable `KASIR_DATA_DIR`, misalnya ke `D:\DataBengkel`.

---

## 🌐 Dipakai bersama beberapa perangkat

Aplikasi ini juga bisa dibuka dari HP/tablet lain **dalam satu jaringan WiFi yang sama**.
Saat `start.bat` dijalankan, alamat LAN akan tampil di jendela command prompt, misalnya:

```
Jaringan LAN: http://192.168.1.15:3001
```

Buka alamat tersebut di browser HP untuk memakai aplikasi dari perangkat lain.

> Ingin membatasi hanya untuk laptop ini saja? Tambahkan environment variable `HOST=127.0.0.1`
> sebelum menjalankan server.

---

## 🧑‍💻 Pengembangan

```bash
npm install          # pasang dependency
npm run seed         # isi data contoh (dilewati bila data sudah ada)
npm run dev          # jalankan Vite (port 5173) + API (port 3001) dengan hot reload
npm run build        # build antarmuka ke folder dist/
npm start            # jalankan server produksi di port 3001
npm run reset        # hapus semua data & isi ulang data contoh
```

### Struktur proyek

```
.
├── server/                 # Backend (Express, tanpa database server)
│   ├── index.js            # Entry point, menyajikan API + berkas statis
│   ├── db.js               # Lapisan penyimpanan JSON (atomic write, auto backup)
│   ├── auth.js             # Login, sesi, hash password (scrypt), role
│   ├── seed.js             # Data contoh bengkel
│   ├── util.js             # Helper bersama
│   └── routes/             # auth, catalog, customers, transactions,
│                           # workorders, expenses, reports, settings
├── src/                    # Frontend (React + TypeScript + Vite + Tailwind v4)
│   ├── components/         # Layout, UI kit, grafik SVG, struk
│   ├── pages/              # Dashboard, Kasir, WorkOrder, Riwayat, Sparepart,
│   │                       # Jasa, Pelanggan, Mekanik, Pengeluaran, Laporan, Pengaturan
│   └── lib/                # api, auth, format, types, hooks
├── data/                   # Data aplikasi (diabaikan Git)
├── install.bat             # Instalasi Windows
├── start.bat               # Peluncur Windows
└── reset-data.bat          # Reset data contoh
```

### Catatan teknis

- **Tanpa native module** — `npm install` tidak butuh Visual Studio Build Tools.
- Password di-hash dengan **scrypt** bawaan Node.js + salt acak.
- Sesi disimpan di server dengan cookie `httpOnly`.
- Role `kasir` otomatis tidak menerima field `costPrice` / `supplier` dari API,
  sehingga harga modal tidak pernah sampai ke browser kasir.
- Penulisan berkas dilakukan secara **atomic** (tulis ke berkas sementara → rename)
  supaya data tidak rusak bila listrik tiba-tiba mati.

---

## 🆘 Masalah umum

| Gejala | Solusi |
|---|---|
| `node` tidak dikenali | Node.js belum terpasang, atau jalankan ulang command prompt setelah instalasi |
| Port 3001 sudah dipakai | Tutup aplikasi lain di port tersebut, atau jalankan `set PORT=3005 && npm start` |
| Halaman "Antarmuka belum di-build" | Jalankan `npm run build` lalu `npm start` |
| Lupa password | Hapus berkas `data/users.json`, lalu jalankan `npm run seed` untuk membuat akun bawaan ulang |
| Data terasa berat / lambat | Backup & hapus transaksi lama lewat menu Riwayat, atau pakai `reset-data.bat` |
| Struk tidak keluar | Pastikan printer thermal terpasang sebagai printer bawaan Windows; gunakan lebar 58mm |

---

## 🖨️ Perangkat keras

Aplikasi mendukung **cetak struk langsung tanpa dialog** dan **buka laci uang otomatis**.
Semua diatur di menu **Pengaturan → tab Perangkat**.

| Perangkat | Dukungan |
|---|---|
| Printer thermal 58/80mm | Cetak langsung lewat **driver Windows**, **jaringan (TCP 9100)**, atau **serial COM** |
| Laci uang | Terbuka otomatis saat pembayaran Tunai (pin 2 atau pin 5) |
| Barcode scanner | Mode keyboard/HID — hasil scan langsung masuk keranjang Kasir |
| Pole display | Kirim 2 baris teks lewat port COM |
| Timbangan digital | Baca berat lewat port COM |

> Semua akses perangkat dilakukan oleh backend (Node.js), karena browser tidak
> diizinkan mengakses USB/serial. Tetap **tanpa native module**: jaringan memakai
> TCP bawaan Node, Windows & serial memakai PowerShell bawaan sistem.

Struk dapat diatur lebarnya (58 mm = 32 karakter, 80 mm = 48 karakter), jumlah
salinan, dan potong kertas otomatis.

---

## 🖥️ Mode aplikasi desktop (.exe)

Aplikasi ini bisa dijadikan **program Windows (.exe)** yang terbuka langsung di layar
seperti aplikasi biasa — **tanpa browser, tanpa CMD** — memakai **Tauri v2 + Node.js sidecar**.

- Semua kode pembungkus desktop ada di folder `src-tauri/`
- Satu-satunya proses yang dibutuhkan: menjalankan **`build-windows.bat`**
  di PC ber-Windows (perlu hak **Administrator**, sekali jalan saja)
- Hasilnya: `Keluaran\Kasir Pintar Bengkel_1.0.0_x64-setup.exe` — tinggal dipasang di laptop
- Data tersimpan di `%APPDATA%\kasir-pintar-bengkel\data`
  (ada tombol **Buka folder data** di Pengaturan → Data & Backup)

**Langkah lengkapnya: lihat `PANDUAN-BUILD.md`.**

> Catatan: menjalankan `.exe` tidak membutuhkan Rust maupun Node.js —
> keduanya hanya diperlukan saat *membuat* installer (bisa dilakukan di warnet).

---

## 🗺️ Rencana pengembangan

- [ ] Kemasan aplikasi desktop (Electron) sehingga tidak perlu membuka browser
- [x] Cetak struk langsung ke printer thermal via ESC/POS (tanpa dialog browser)
- [x] Buka laci uang otomatis
- [ ] Tampilan pelanggan di monitor kedua
- [ ] Shift kasir & tutup buku harian
- [ ] Mode offline PWA untuk HP mekanik
- [ ] Pembelian & penerimaan barang dari supplier (PO)
- [ ] Notifikasi WhatsApp pengingat servis berkala pelanggan
- [ ] Shift kasir & tutup buku harian

---

Dibuat untuk bengkel UMKM Indonesia 🇮🇩
