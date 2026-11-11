# PRODEMY (React + Supabase)

Aplikasi portofolio dan absensi Brother Academy. Front-end React (Vite), database dan login memakai Supabase.

## 1. Siapkan Supabase
1. Buka proyek Supabase kamu (cloud: supabase.com, atau lokal: `supabase start`).
2. Jalankan file-file ini di **SQL Editor**, berurutan, dari `20260101` sampai `20260106` (untuk lokal otomatis lewat `supabase db reset`):
   1. `supabase/migrations/20260101000000_init.sql`: tabel, aturan keamanan (RLS), bucket `photos` dan `proofs`.
   2. `supabase/migrations/20260102000000_portal.sql`: fitur portal orang tua (daftar online dan dashboard anak).
3. Buat akun admin pertama: **Authentication > Users > Add user**
   - Email: `admin@prodemy.app`, password pilihanmu, centang **Auto Confirm User**.
   - Lalu di SQL Editor jalankan:
     ```sql
     insert into public.profiles (id, name, username, role)
       select id, 'Admin', 'admin', 'admin' from auth.users where email = 'admin@prodemy.app';
     ```
   Login di aplikasi memakai username `admin` (aplikasi otomatis menambahkan `@prodemy.app`).

## 2. Jalankan aplikasi
```
copy .env.example .env      (lalu isi URL dan anon key dari Project Settings > API)
npm install
npm run dev
```
Buka http://localhost:5173

## 3. Kelola akun dari dalam aplikasi
Menu Pengaturan > Kelola akun (tambah akun, reset password, hapus) memakai fungsi SQL di database, **tanpa Edge Function**.
Cukup jalankan `supabase/migrations/20260106000000_accounts_profile_nonik.sql` di SQL Editor.
Migrasi yang sama juga: menghapus kewajiban NIK, menaikkan batas foto menjadi 5 MB, dan mengaktifkan foto anak + ubah profil di dashboard orang tua.
Folder `supabase/functions/manage-users` tidak dipakai lagi (boleh dihapus).

## 4. Pasang online (gratis)
Push ke GitHub lalu impor ke **Vercel** atau **Netlify**. Isi environment variable `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`. Build command `npm run build`, output `dist`.

## 5. Portal orang tua (tanpa login)
Halaman depan `/` punya dua pilihan, dan link **Login sebagai admin** di bawahnya:
- **Daftar Academy** (`/daftar`): isi data orang tua, pilih paket Reguler/Member, tambah 1 anak atau lebih. Harga dihitung otomatis, promo sekeluarga berlaku mulai 3 anak. Data langsung masuk ke tabel `students` (status `trial`, penanda `source = online`), jadi langsung muncul di **Data Trial** dan **Data Academy** milik admin.
- **Sudah Mendaftar** (`/masuk`): tulis nama lengkap anak, lalu masuk ke dashboard (`/anak`): grafik hadir/tidak hadir, pengingat jadwal 16.00 - 17.30 WITA sesuai kategori, link grup WhatsApp, dan menu **Pembayaran Member** (`/anak/pembayaran`).

### Profil murid di dashboard orang tua
Jalankan migrasi `supabase/migrations/20260105000000_portal_profile.sql` (menambah tanggal lahir dan nama orang tua). Tanpa migrasi ini kartu profil tetap tampil, hanya tanpa dua baris tersebut. Nomor HP dan pekerjaan orang tua sengaja tidak ditampilkan di portal karena halaman ini tidak memakai login.

### Foto anak wajib saat daftar
Jalankan migrasi `supabase/migrations/20260104000000_registration_photo.sql`. Di `/daftar` setiap anak wajib punya foto (otomatis dikecilkan di browser). Foto tampil di Data Academy dan Data Trial milik admin.

### Pembayaran transfer + bukti bayar
Jalankan juga migrasi ketiga: `supabase/migrations/20260103000000_payment_proofs.sql`.
- Di `/anak/pembayaran` orang tua melihat rekening **Bank Mandiri** (diatur di `BANK` dalam `src/lib/portal.js`), memilih anak dan bulan, lalu mengunggah bukti transfer (foto/PDF maks. 5 MB).
- Data langsung masuk ke menu admin **Bukti Bayar** (`/payments/proofs`) dengan status "Sudah bayar, menunggu verifikasi". Jumlah yang menunggu tampil sebagai badge di menu.
- Admin/bendahara menekan **Setujui**: tabel `payments` terisi otomatis (status Lunas + bukti) dan terlihat di Payment Member serta dashboard orang tua. **Tolak** bisa disertai alasan yang terlihat orang tua.
- Hanya anak berstatus **member** yang bisa dibayarkan lewat portal.

Pengaturan harga, jam latihan, link grup WhatsApp, dan nomor admin ada di satu file: `src/lib/portal.js`.
Pengunjung tidak punya akses langsung ke tabel. Mereka hanya memanggil fungsi `portal_register` dan `portal_data` yang hanya mengembalikan data terbatas (tanpa nomor HP dan pekerjaan).

### Foto
Batas ukuran foto 5 MB (aplikasi menolak file lebih besar dan mengecilkan foto sebelum diunggah). Orang tua bisa mengganti foto anak lewat tombol **Ubah profil & foto** di dashboard.
