# 🧪 Panduan Review — Kasir Pintar Bengkel

Dokumen ini berisi langkah-langkah untuk **meninjau (review) aplikasi** sebelum dipakai
di bengkel sungguhan. Pilih salah satu mode di bawah ini sesuai waktu yang Anda punya.

| Mode | Waktu | Bagian yang dikerjakan |
|---|---|---|
| ⚡ **Cepat** | ~30 menit | Bagian 0, 1, 2, 3 |
| 🔍 **Menyeluruh** | ~2 jam | Bagian 0 sampai 8 |
| 🛠️ **Teknis / kode** | ~1 jam | Bagian 0, 9, 10 |

**Cara memakai:** centang setiap kotak. Bila ada yang tidak sesuai, catat di
**Bagian 11 (Template laporan temuan)** lalu kirimkan kepada saya.

---

## 0. Persiapan

- [ ] Jalankan aplikasi (`start.bat` di Windows, atau pastikan preview hidup di port 3001)
- [ ] Login sebagai **`owner / owner123`**
- [ ] Buka satu sesi lagi dengan akun **`kasir / kasir123`** di jendela penyamaran / browser lain
      (untuk menguji hak akses di Bagian 3 tanpa perlu login-ulang)
- [ ] Catat kondisi awal (snapshot) sebagai pembanding:

| Data | Nilai saat ini | Cara melihat |
|---|---|---|
| Omzet hari ini | Rp 1.309.000 | Dashboard → kartu "Omzet hari ini" |
| Transaksi bulan ini | 65 | Dashboard → "Ringkasan bulan ini" |
| Work order aktif | 4 | Dashboard → kartu "Work order aktif" |
| Stok menipis | 12 dari 30 | Dashboard → panel "Stok menipis" |
| Piutang belum lunas | 5 transaksi | Dashboard → kartu "Piutang belum lunas" |

> ⚠️ **Angka di atas hanya contoh.** Data contoh dibuat acak setiap kali `data/` kosong,
> jadi angka Anda akan berbeda. Catat angka Anda sendiri sebagai pembanding.

- [ ] Pahami cara mengembalikan data jika pengujian membuat data berantakan:
      - Windows: dobel-klik **`reset-data.bat`**
      - Terminal: **`npm run reset`** (data lama otomatis dibackup ke `data/backups/`)

---

## 1. Skenario uji wajib (alur utama)

Kerjakan berurutan. **Jangan lewati S4 dan S5** — dua skenario ini paling sering
menjadi sumber masalah pada aplikasi kasir.

### S1 — Transaksi tunai lengkap ✅ tujuan utama

**Langkah**
1. Masuk ke menu **Kasir**
2. Ketik `oli` di kolom pencarian → beberapa item muncul
3. Klik 2 item berbeda (mis. *Oli Mesin* dan *Ganti Oli Motor*)
4. Pada keranjang, ubah jumlah salah satu item dengan tombol **+**
5. Pilih **metode Tunai**, isi *Uang diterima* lebih besar dari total
6. Klik **Bayar & Cetak**

**Hasil yang diharapkan**
- [ ] Item masuk ke keranjang dengan harga sesuai katalog
- [ ] Kolom *Subtotal / Total* berubah mengikuti jumlah item
- [ ] *Kembalian* terhitung benar (Uang diterima − Total)
- [ ] Muncul struk, dan dialog cetak terbuka
- [ ] Stok sparepart **berkurang** sesuai jumlah yang terjual (cek di menu Sparepart)
- [ ] Transaksi muncul di **Riwayat Transaksi** dan di **Dashboard → Transaksi terakhir**

---

### S2 — Validasi stok tidak mencukupi

**Langkah:** di menu Kasir, cari sparepart yang stoknya sedikit, lalu klik tombol **+**
melebihi jumlah stoknya.

**Hasil yang diharapkan**
- [ ] Tombol **+** menjadi nonaktif saat jumlah sudah sama dengan stok
- [ ] Bila dipaksa lewat API, server menolak dengan pesan *"Stok … tidak mencukupi"*
- [ ] Item dengan stok 0 **tidak bisa diklik** pada katalog

---

### S3 — Diskon, PPN, dan catatan

**Langkah:** tambahkan item → masukkan **Diskon transaksi** → centang **Kenakan PPN 11%**
→ isi Catatan → simpan.

**Hasil yang diharapkan**
- [ ] Diskon mengurangi total
- [ ] PPN dihitung dari (Subtotal − Diskon), bukan dari Subtotal
- [ ] Baris PPN muncul di struk
- [ ] Catatan tersimpan dan tampil di modal detail Riwayat
- [ ] Total tidak pernah bernilai minus

---

### S4 — Transaksi bon (kredit) lalu dilunasi

**Langkah**
1. Buat transaksi dengan metode **Kredit / Bon**
2. Buka **Riwayat Transaksi**, cari transaksi tersebut
3. Periksa badge yang muncul, lalu buka detailnya
4. Klik **Tandai lunas**

**Hasil yang diharapkan**
- [ ] Saat memilih Bon, kolom *Uang diterima* menghilang / tidak wajib
- [ ] Badge **Bon** muncul di daftar Riwayat
- [ ] Kartu *Piutang belum lunas* di Dashboard bertambah 1
- [ ] Setelah **Tandai lunas**, badge Bon hilang dan piutang berkurang
- [ ] Struk mencantumkan *** BELUM LUNAS (BON) ***

---

### S5 — Pembatalan transaksi & pengembalian stok ⚠️ paling penting

**Langkah**
1. Catat stok sebuah sparepart (mis. *Oli Gardan 120ml* = 40)
2. Buat transaksi yang memakai sparepart itu sebanyak 3
3. Catat stok setelah transaksi (harusnya 37)
4. Buka **Riwayat → detail → Batalkan transaksi** (khusus owner), isi alasan
5. Kembali ke menu **Sparepart**, periksa stoknya lagi
6. Buka **Riwayat stok** (tombol 🕘) pada baris tersebut

**Hasil yang diharapkan**
- [ ] Stok **kembali ke 40**
- [ ] Riwayat pergerakan stok memuat 2 entri baru: *Penjualan* (keluar 3) dan *Retur/pembatalan* (masuk 3)
- [ ] Baris transaksi berubah merah muda dengan badge **Batal**
- [ ] Transaksi batal **tidak dihitung** lagi dalam omzet & laporan
- [ ] Struk transaksi batal mencantumkan *** TRANSAKSI DIBATALKAN ***
- [ ] Akun **kasir tidak melihat** tombol "Batalkan transaksi" (hanya owner)

---

### S6 — Work Order → Kasir

**Langkah**
1. Menu **Work Order** → **Buat Work Order** → isi pelanggan & keluhan → simpan
2. Pada kartu SPK baru, klik **Mulai** → status jadi *Dikerjakan*
3. Klik **Selesai** → status jadi *Selesai*
4. Klik **Ke Kasir**

**Hasil yang diharapkan**
- [ ] Anda berpindah ke halaman Kasir dengan **item, pelanggan, dan kendaraan sudah terisi**
- [ ] Setelah dibayar, SPK otomatis berstatus **Diambil**
- [ ] Di detail SPK muncul kode transaksinya
- [ ] SPK yang sudah masuk transaksi **tidak bisa dihapus**

---

### S7 — Jasa servis dengan mekanik (komisi)

**Langkah:** di Kasir, tambahkan sebuah **jasa servis** → pilih mekanik pada item tersebut
→ simpan. Lalu buka **Laporan → Kinerja mekanik**.

**Hasil yang diharapkan**
- [ ] Pilihan mekanik muncul **hanya pada item jasa**, bukan pada sparepart
- [ ] Mekanik yang dipilih muncul di laporan dengan nilai omzet & komisi
- [ ] Komisi = omzet × persentase bagi hasil mekanik
- [ ] Total komisi ikut mengurangi **laba bersih** di laporan

---

### S8 — Cetak struk

- [ ] Struk tampil rapi: nama bengkel, alamat, telepon di tengah
- [ ] Daftar item, subtotal, diskon, PPN, total, tunai, kembalian tercetak
- [ ] Lebar kertas bisa diubah 58mm ↔ 80mm di **Pengaturan → Profil Bengkel**
- [ ] **Pratinjau struk** di Pengaturan berubah langsung saat Anda mengetik nama bengkel
- [ ] Tombol **Cetak ulang** di Riwayat menghasilkan struk yang sama

---

## 2. Review per halaman

Tandai ✅ bila halaman tampil benar dan fiturnya berjalan.

| # | Halaman | Yang wajib diperiksa |
|---|---|---|
| 1 | **Login** | Galat muncul untuk password salah; form tidak bisa dikosongkan; akun demo tertera |
| 2 | **Dashboard** | 4 kartu terisi; grafik 30 hari tampil; stok menipis & transaksi terakhir muncul; footer nilai stok (owner) |
| 3 | **Kasir** | Pencarian cepat; filter tab & kategori; keranjang; diskon; 5 metode bayar; kembalian; tombol nominal cepat |
| 4 | **Work Order** | 4 kartu status; filter; ubah status; Ke Kasir; detail SPK |
| 5 | **Riwayat** | Filter tanggal/metode/status; pencarian; detail; batalkan; tandai lunas; ekspor CSV |
| 6 | **Sparepart** | Statistik 4 kartu; tabel; tambah/ubah/hapus; penyesuaian stok; riwayat pergerakan |
| 7 | **Jasa Servis** | Tabel jasa; tambah/ubah/hapus; kelola kategori (chip) |
| 8 | **Pelanggan** | Tabel; modal detail; tambah/ubah/hapus kendaraan; riwayat transaksi per pelanggan |
| 9 | **Mekanik** | Persentase bagi hasil; omzet & komisi bulan berjalan |
| 10 | **Pengeluaran** | Filter periode; tambah/ubah/hapus; rincian kategori; total; ekspor CSV |
| 11 | **Laporan** | 6 preset periode; 6 kartu laba rugi; 3 grafik; 3 panel peringkat; ekspor CSV |
| 12 | **Pengaturan** | 5 tab: Profil (+pratinjau struk), **Perangkat**, Pengguna, Data & Backup, Tentang |

---

## 3. Review hak akses (role)

Buka sesi kedua dengan akun **`kasir / kasir123`**. Hal berikut **harus tertutup** untuk kasir:

| Yang diuji | Harapan |
|---|---|
| Menu sidebar | **Pengeluaran, Laporan, Pengaturan, Mekanik tidak tampil** |
| Kolom "Harga Beli" di Sparepart | **Tidak tampil** |
| Kolom "Nilai stok (modal)" di Dashboard | **Tidak tampil** |
| Tombol "Batalkan transaksi" di Riwayat | **Tidak tampil** |
| Tombol "Hapus" di Sparepart / Jasa / Pelanggan | **Tidak tampil** |
| Angka laba di Laporan | Kalau dibuka paksa, bernilai kosong/kartu non-finansial |
| Mengubah harga item di keranjang | **Tidak bisa** (hanya owner) |
| Menghapus akun owner terakhir | Server menolak |

**Cara memeriksanya lebih ketat** (opsional):
buka Developer Tools → tab Network → cari permintaan `/api/products`.
DiResponse-nya, pastikan field `costPrice` **tidak ada** untuk akun kasir.
(Ini penting: datanya memang tidak dikirim, bukan sekadar disembunyikan di layar.)

---

## 4. Review integritas data

- [ ] **Stok konsisten** — total stok di menu Sparepart sama dengan hasil transaksi + penyesuaian − penjualan
- [ ] **Tahan restart** — tutup aplikasi (`Ctrl+C`), jalankan lagi → semua data masih ada
- [ ] **Tahan refresh browser** — segarkan halaman → data tetap; keranjang kosong (wajar, keranjang belum disimpan sebagai draft)
- [ ] **Backup berjalan** — Pengaturan → Data & Backup → **Buat Backup Sekarang** → berkas masuk ke daftar
- [ ] **Unduh backup** — klik **Unduh** → berkas `.json` terunduh dan bisa dibuka
- [ ] **Pulihkan** — klik **Pulihkan** pada salah satu backup → data kembali seperti saat backup dibuat
- [ ] **Reset** — jalankan `npm run reset` → data contoh kembali, dan backup lama tersimpan di `data/backups/`
- [ ] **CSV bisa dibuka di Excel** — ekspor dari Riwayat, buka di Excel, pastikan karakter Indonesia tidak rusak

---

## 5. Review cetak & perangkat keras (khusus Windows)

Bagian ini **hanya bisa diuji di laptop Windows Anda** (sandbox ini memakai Linux).

- [ ] Buka **Pengaturan → tab Perangkat**
- [ ] Bagian *Informasi sistem* menampilkan platform `win32` dan **Deteksi printer: Tersedia**
- [ ] Klik **Muat daftar** → printer thermal Anda muncul di daftar
- [ ] Pilih jenis pencetakan:
      - [ ] **Printer Windows** → pilih printer Anda dari daftar
      - [ ] **Jaringan** → isi IP printer (uji dengan **Tes Koneksi**)
      - [ ] **Serial** → isi port COM & baud rate
- [ ] Klik **Cetak Struk Uji** → struk keluar **tanpa dialog cetak**
- [ ] Klik **Buka Laci Uang** → laci terbuka
- [ ] Lakukan transaksi **Tunai** → struk tercetak **dan** laci terbuka otomatis
- [ ] Uji barcode scanner: arahkan ke barcode → kode masuk kolom pencarian → tekan Enter → item masuk keranjang
- [ ] Matikan opsi *Buka laci otomatis* → laci tidak terbuka lagi saat transaksi Tunai

> Bila gagal: buka panel log di tab Perangkat — pesan galatnya ditampilkan di sana.

---

## 6. Review tampilan & kegunaan (UX)

- [ ] Buka di resolusi **1366×768** (umum laptop) — tidak ada elemen yang terpotong/berdesakan
- [ ] Buka di **1920×1080** — tabel tidak melebar berlebihan
- [ ] Perkecil jendela ke ukuran tablet — sidebar berubah menjadi menu yang bisa dibuka/tutup
- [ ] Navigasi **hanya dengan keyboard**: Tab antar kolom, Enter untuk submit, Esc untuk menutup modal
- [ ] Setiap aksi penting memberi umpan balik: notifikasi sukses/gagal muncul di pojok kanan bawah
- [ ] Saat data sedang dimuat, muncul indikator loading (bukan layar kosong)
- [ ] Format rupiah konsisten: titik pemisah ribuan, tanpa desimal, didahului `Rp`
- [ ] Format tanggal Indonesia: `09 Okt 2026` bukan `10/09/2026`
- [ ] Tidak ada teks berbahasa Inggris yang tersisa di antarmuka (kecuali istilah teknis)

---

## 7. Review performa

- [ ] Halaman Dashboard terbuka **< 2 detik**
- [ ] Pencarian sparepart terasa **langsung** (tanpa jeda saat mengetik)
- [ ] Riwayat dengan ratusan transaksi tetap lancar saat pindah halaman
- [ ] Laporan dengan periode 30 hari tetap responsif
- [ ] Ekspor CSV ratusan baris selesai dalam hitungan detik

> Untuk bengkel UMKM, data bertahun-tahun pun masih jauh di bawah batas wajar.
> Bila terasa melambat, solusinya cukup: backup lalu arsipkan transaksi lama.

---

## 8. Review keamanan dasar

- [ ] Buka `data/users.json` → password **tidak** tersimpan dalam bentuk terang (harusnya diawali `scrypt$`)
- [ ] Cookie sesi bertanda `HttpOnly` (cek di Developer Tools → Application → Cookies)
- [ ] Setelah logout, mencoba membuka `/` akan mengarahkan kembali ke halaman Login
- [ ] Harga modal benar-benar tidak dikirim ke akun kasir (lihat Bagian 3)
- [ ] Karena aplikasi bisa diakses dari perangkat lain di WiFi yang sama, pertimbangkan
      mengatur `HOST=127.0.0.1` bila hanya ingin dipakai di satu laptop

---

## 9. Review kode (untuk yang ingin menelaah struktur)

Jalankan dulu pemeriksaan otomatis:

```bash
npm install
npx tsc --noEmit     # pemeriksaan tipe TypeScript — harus tanpa galat
npm run build        # build produksi — harus berhasil
```

**Struktur yang perlu dipahami**

| Berkas | Peran |
|---|---|
| `server/db.js` | Lapisan penyimpanan JSON — atomic write, backup, proteksi korupsi |
| `server/auth.js` | Hash scrypt, sesi, middleware role |
| `server/routes/*.js` | 9 berkas route — satu berkas per modul |
| `server/hardware/escpos.js` | Perintah ESC/POS (murni JS) |
| `server/hardware/printer.js` | 4 jalur kirim ke perangkat |
| `src/components/ui.tsx` | Komponen dasar (tombol, modal, tabel, notifikasi) |
| `src/pages/*.tsx` | 12 halaman |
| `src/lib/*` | api, auth, format, types, hooks, hardware |

**Yang patut menjadi sorotan saat review kode**
- [ ] Apakah setiap `router.post/put/delete` sudah dilindungi `requireAuth` / `requireRole`?
- [ ] Apakah ada endpoint yang mengembalikan `costPrice` tanpa menyaring role?
- [ ] Apakah penulisan berkas selalu lewat `db.insert/update` (atomic) — bukan `fs.writeFile` langsung?
- [ ] Apakah angka uang selalu bilangan bulat (rupiah tanpa desimal)?
- [ ] Apakah ada `console.log` berisi data sensitif yang tertinggal?

---

## 10. Review lewat GitHub (Pull Request)

Bila Anda ingin meninjau perubahan langsung di GitHub:

1. Buka <https://github.com/Richie-Akbar-dev/kasir-pintar-bengkel-/pull/new/arena/4405f452-kasir-pintar-bengkel>
2. Pilih `base: main` ← `compare: arena/4405f452-kasir-pintar-bengkel`
3. Klik **Create pull request**
4. Di tab **Files changed**, klik tanda **+** pada baris kode untuk memberi komentar
5. Di akhir, klik **Review changes** lalu pilih:
   - **Comment** — hanya catatan
   - **Approve** — setuju, siap digabung
   - **Request changes** — minta perbaikan dulu
6. Bila sudah disetujui, gabungkan dengan **Merge pull request**

**Yang biasa saya periksa pada PR:** konsistensi format, tidak ada berkas rahasia ikut
tercommit, tidak ada `node_modules`/`data`/`dist` masuk ke Git, dan pesan commit jelas.

---

## 11. Template laporan temuan

Salin tabel ini dan isi temuan Anda:

| # | Halaman / Modul | Yang terjadi | Yang diharapkan | Tingkat | Langkah mengulang |
|---|---|---|---|---|---|
| 1 | | | | Ringan / Sedang / Kritis | 1. … 2. … 3. … |
| 2 | | | | | |
| 3 | | | | | |

**Tingkat:**
- 🔴 **Kritis** — data bisa salah/hilang, uang bisa salah hitung
- 🟡 **Sedang** — fitur tidak berjalan sebagaimana mestinya, tapi ada jalan lain
- 🟢 **Ringan** — gangguan tampilan, salah kata, atau usulan peningkatan

---

## 12. Kriteria "siap dipakai di bengkel"

Centang semua sebelum benar-benar dipakai bertransaksi:

- [ ] Skenario S1 sampai S8 **semua lulus**
- [ ] Hak akses kasir sudah benar (Bagian 3)
- [ ] Pembatalan transaksi mengembalikan stok dengan benar (S5)
- [ ] Backup & pemulihan sudah dicoba **minimal sekali**
- [ ] Printer thermal dan laci uang sudah diuji di laptop Windows (Bagian 5)
- [ ] Password bawaan `owner123` dan `kasir123` **sudah diganti**
- [ ] Identitas bengkel, alamat, dan telepon sudah diisi di Pengaturan
- [ ] Data contoh sudah dibersihkan (gunakan `npm run reset` lalu hapus data yang tidak perlu)

---

## 13. Batasan yang sudah diketahui

Mohon **jangan** dilaporkan sebagai bug — ini memang belum dikerjakan:

| Hal | Status |
|---|---|
| Keranjang hilang saat browser di-refresh | Belum ada fitur simpan draft |
| Mesin EDC / QRIS | Dicatat manual (integrasi bank butuh kerja sama acquirer) |
| Tampilan pelanggan di monitor kedua | Rencana Tahap 2 |
| Shift kasir & tutup buku | Rencana Tahap 3 |
| Pembelian dari supplier (PO) | Rencana Tahap 4 |
| Aplikasi desktop tanpa browser (Electron) | Rencana Tahap 5 |
| Daftar printer di sistem non-Windows | Tidak didukung (hanya Windows) |
| Angka data contoh berubah setiap kali seeding | Wajar, karena dibuat acak |
| Aplikasi bisa dibuka dari perangkat lain dalam WiFi yang sama | Bisa dibatasi dengan `HOST=127.0.0.1` |

---

### Butuh bantuan saat review?

Sampaikan saja nomor skenario atau nomor baris temuannya, misalnya:
*"S5 gagal — stok tidak kembali"* atau *"Bagian 3, kolom harga beli masih muncul untuk kasir"*.
Nanti saya perbaiki dan laporkan perubahannya.
