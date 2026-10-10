# PANDUAN BUILD DI WARNET — Kasir Pintar Bengkel (.exe)

Panduan ini untuk **membuat berkas installer aplikasi desktop** (`Kasir Pintar Bengkel_1.0.0_x64-setup.exe`).
Sekali dibuat, installer itu bisa dipasang di laptop Anda **tanpa internet, tanpa Node, tanpa browser** —
terbuka langsung seperti aplikasi Windows pada umumnya.

> ⏱️ **Perkiraan waktu di warnet: 1–2 jam** (sebagian besar untuk unduhan ±3 GB + kompilasi Rust)
> 💾 **Yang harus dibawa: flashdisk** (untuk membawa pulang installer)

---

## Tahap 0 — Sebelum berangkat

- [ ] Pastikan di laptop Anda sudah **tidak ada** yang perlu dikerjakan (build dilakukan di warnet, bukan di laptop)
- [ ] Siapkan flashdisk (kosong minimal 1 GB)
- [ ] Catat alamat halaman ini (atau unduh ZIP-nya lebih dulu di rumah, lihat Tahap 2)

---

## Tahap 1 — Pastikan hak Administrator

1. Buka **CMD** di PC warnet (tekan `Win` → ketik `cmd` → Enter)
2. Ketik:
   ```bat
   net session
   ```
3. Baca hasilnya:

   | Hasil | Arti |
   |---|---|
   | `Access is denied` / `System error 5` | ❌ Bukan Administrator — lihat langkah 4 |
   | `There are no entries in the list.` | ✅ Administrator — lanjut Tahap 2 |

4. Kalau bukan administrator:
   - **Tutup** CMD tadi
   - Cari aplikasi **Command Prompt** di menu Start
   - **Klik kanan** → pilih **"Run as administrator"**
   - Ulangi `net session`

   > ⚠️ **Jebakan paling sering:** akun Anda memang Administrator, tapi CMD tidak dibuka
   > dengan "Run as administrator". Penanda berhasil: prompt berubah menjadi
   > `C:\Windows\system32>`

**Semua langkah di bawah dilakukan di CMD "Run as administrator" ini, dalam SATU sesi
(tutup CMD = harus ulang dari Tahap 1).**

---

## Tahap 2 — Ambil kode aplikasi

**Pilih salah satu:**

**Cara A — ZIP (tanpa Git, paling mudah):**
1. Buka browser, unduh:
   ```
   https://github.com/Richie-Akbar-dev/kasir-pintar-bengkel-/archive/refs/heads/arena/4405f452-kasir-pintar-bengkel.zip
   ```
2. Klik kanan ZIP → **Extract All** → taruh di `D:\` atau `C:\` (jangan di folder Downloads)

**Cara B — Git:**
```bat
git clone https://github.com/Richie-Akbar-dev/kasir-pintar-bengkel-.git
cd kasir-pintar-bengkel-
git checkout arena/4405f452-kasir-pintar-bengkel
```

Lalu masuk ke folder aplikasi di CMD:
```bat
cd /d D:\kasir-pintar-bengkel--arena-4405f452-kasir-pintar-bengkel
```
*(nama folder ZIP bisa berbeda — yang penting `dir` menampilkan `build-windows.bat`)*

---

## Tahap 3 — Jalankan build

```bat
build-windows.bat
```

Skrip ini akan **otomatis** memeriksa dan memasang apa pun yang kurang:

| Tahap | Isi | Perkiraan |
|---|---|---|
| [1/8] | Cek hak administrator | seketika |
| [2/8] | Cek / pasang **Node.js** | 0–5 menit |
| [3/8] | Cek / pasang **Rust** | 0–5 menit |
| [4/8] | Cek / pasang **MSVC Build Tools** (±2 GB) | 0–45 menit |
| [5/8] | Pasang perpustakaan aplikasi | 1–3 menit |
| [6/8] | Bangun tampilan aplikasi | 1 menit |
| [7/8] | Siapkan paket (node.exe + server) | 1–2 menit |
| [8/8] | Rakit **installer .exe** | 10–30 menit |

Semua aktivitas dicatat ke **`build-log.txt`** di folder yang sama.

> **Jangan tutup jendela CMD** selama proses berjalan. Layar akan penuh teks — itu normal.

---

## Tahap 4 — Ambil hasilnya

Kalau berhasil, muncul tulisan **BUILD SELESAI** dan folder **`Keluaran`** berisi installer:

```
kasir-pintar-bengkel-...\
└── Keluaran\
    └── Kasir Pintar Bengkel_1.0.0_x64-setup.exe   ← INI HASILNYA
```

- [ ] **Salin berkas installer itu ke flashdisk SEKARANG** (jangan tunggu)
- [ ] Opsional: salin juga `build-log.txt` (untuk jaga-jaga bila perlu laporan)

> ⚠️ **Deep Freeze:** banyak warnet menghapus SEMUA perubahan saat PC restart.
> Selama Anda belum memegang installer di flashdisk/HP, **pekerjaan belum aman.**

---

## Tahap 5 — Pasang di laptop rumah

1. Colok flashdisk → salin `Kasir Pintar Bengkel_1.0.0_x64-setup.exe` ke laptop
2. **Dobel-klik** installer → ikuti langkahnya (Next, Next, Install)
3. Kalau muncul peringatan **SmartScreen** (aplikasi belum memiliki sertifikat):
   - Klik **"Info selengkapnya"**
   - Klik **"Tetap jalankan"**
4. Aplikasi muncul di menu Start seperti aplikasi biasa — **terbuka langsung di layar,
   tanpa browser, tanpa CMD**

**Lokasi data:** `C:\Users\<nama>\AppData\Roaming\kasir-pintar-bengkel\data`
(bisa juga lewat aplikasi: **Pengaturan → Data & Backup → Buka folder data**)

---

## Kalau gagal

1. **Jangan panik, jangan ulang dari awal** — kirim dua hal ini ke pengembang:
   - Berkas **`build-log.txt`** (di folder aplikasi)
   - **Foto / salinan teks error** yang muncul di layar CMD
2. Pengembang akan membaca log-nya dan memberi langkah perbaikan —
   biasanya cukup menjalankan `build-windows.bat` lagi setelah diperbaiki.

---

## Daftar periksa singkat (tempel di layar)

```
[ ] 1. CMD = Run as administrator  (net session harus sukses)
[ ] 2. Masuk folder aplikasi       (dir harus ada build-windows.bat)
[ ] 3. Jalankan build-windows.bat  (tunggu sampai tulisan BUILD SELESAI)
[ ] 4. Salin Keluaran\*.exe ke flashdisk   ← SEBELUM PC RESTART
[ ] 5. (opsional) salin build-log.txt
```
