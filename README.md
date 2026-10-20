# KAFE RADAR Online — starter MVP

Fondasi aplikasi web untuk pilot awal KAFE RADAR: kampanye menu, respons minat pelanggan, dan dashboard pemilik.

## Isi
- `src/app/page.tsx` — landing page.
- `src/app/dashboard/page.tsx` — login/daftar, membuat kampanye (termasuk foto menu), mengatur tautan promosi media sosial, menghentikan/mengaktifkan kembali/menghapus kampanye, membuat QR, dan melihat respons.
- `src/app/dashboard/kampanye/[slug]/page.tsx` — halaman analitik per kampanye: tren respons harian, peringkat menu dengan % minat beli, dan rekap kisaran harga.
- `src/app/c/[slug]/page.tsx` — halaman survei publik untuk pelanggan, menampilkan foto menu dan tombol tautan sosial media.
- `supabase/schema.sql` — tabel dan kebijakan Row Level Security.
- `.env.example` — variabel konfigurasi yang diperlukan.

## Yang dibutuhkan
- Node.js 20 atau lebih baru.
- Akun Supabase.
- (Opsional untuk publikasi) akun Vercel.

## Menjalankan di komputer
1. Ekstrak ZIP.
2. Buat project baru di Supabase.
3. Buka **SQL Editor** di Supabase, lalu jalankan seluruh isi `supabase/schema.sql`.
4. Di Supabase, buka **Project Settings → API** dan salin Project URL serta anon/public key.
5. Salin `.env.example` menjadi `.env.local`, lalu isi:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Buka terminal pada folder proyek, jalankan:
   ```bash
   npm install
   npm run dev
   ```
7. Buka `http://localhost:3000`.
8. Masuk ke dashboard, daftar akun menggunakan email dan kata sandi, lalu buat kampanye.
9. Bagikan URL kampanye dengan format `http://localhost:3000/c/slug-kampanye` hanya untuk tes di komputer sendiri. Untuk pelanggan nyata, deploy terlebih dahulu.

## Deploy online (ringkas)
1. Push folder proyek ke repository GitHub.
2. Import repository tersebut di Vercel.
3. Tambahkan dua environment variables Supabase yang sama di pengaturan proyek Vercel.
4. Deploy, lalu tes alur daftar/login, buat kampanye, dan kirim respons menggunakan ponsel lain.
5. URL kampanye online akan berbentuk `https://domain-anda/c/slug-kampanye`. Tombol **QR & tautan** di dashboard membuat kode QR dari URL tersebut dan menyediakan unduhan PNG untuk ditempel di meja atau dikirim lewat WhatsApp.

## Batasan versi awal
- Ini adalah starter code, bukan aplikasi yang sudah dipasang atau dideploy.
- Belum ada pembayaran, pencatatan penjualan aktual, atribusi promosi, multi-user per kafe, atau laporan ekspor.
- Pendaftaran akun memakai Supabase Auth. Untuk pilot, pemilik kafe sebaiknya menggunakan email khusus bisnis.
- Anti-spam survei bersifat penghalau (honeypot, jeda waktu, satu respons per perangkat), bukan penolakan berbasis IP. Untuk publikasi luas, pertimbangkan pembatasan di sisi server.
- Survei mengukur minat, bukan bukti transaksi. Jangan menjanjikan peningkatan penjualan hanya dari hasil survei.
- Jangan menyimpan data pribadi sensitif pelanggan.
- Foto menu disimpan di Supabase Storage (bucket `menu-photos`). Video promosi tidak disimpan di aplikasi—pengguna menautkan langsung ke Instagram, TikTok, YouTube, dan sejenisnya.
- Menghapus kampanye ikut menghapus menu, respons, tautan promosi kampanye, dan foto menu di Storage. Kampanye nonaktif tetap menyimpan datanya tetapi menolak respons baru. Baris profil kafe belum bisa dihapus dari dashboard; gunakan SQL Editor bila perlu.
- Database pilot yang sudah terlanjur berjalan perlu menambahkan policy `owner reads menu items` (lihat `supabase/schema.sql`) agar harga menu tetap tampil di halaman analitik untuk kampanye nonaktif. Blok SQL-nya idempoten dan aman dijalankan ulang.

## Catatan teknis
Kode menggunakan Next.js App Router, React, TypeScript, dan Supabase JS. SQL mengaktifkan Row Level Security dan membatasi akses dashboard ke pemilik kampanye. Uji semua kebijakan dalam project Supabase terpisah sebelum menerima data pelanggan sungguhan.
