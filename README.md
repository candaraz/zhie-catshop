# Zhie Catshop — Aplikasi Kasir (POS) & Manajemen Keuangan

Aplikasi web Progressive Web App (PWA) modern untuk toko makanan kucing dan perlengkapan hewan peliharaan. Responsif untuk HP Android, iPhone, tablet, dan laptop.

## Fitur Utama
- **Multi-User & Hak Akses (RBAC)**: Peran **Owner/Pemilik** (akses penuh) dan **Kasir/Karyawan** (hak akses granular yang ditegakkan di frontend maupun backend Supabase RLS).
- **Dashboard Real-Time**: Total penjualan, uang masuk, pengeluaran, saldo kas, piutang, stok menipis, laba kotor, grafik harian & bulanan, dan transaksi terbaru — 100% dihitung dari database.
- **Kasir (POS)**: Pencarian, filter kategori, keranjang, ubah harga jual dengan konfirmasi (Owner), diskon, pembayaran tunai/transfer/kredit/sebagian, hitung kembalian, proteksi anti transaksi ganda (`idempotency_key`), cetak & unduh struk PDF.
- **Produk & Stok Manual**: 7 kategori awal, 6 satuan (`pcs`, `kg`, `gram`, `karung`, `sachet`, `botol`). **Penjualan tidak mengurangi stok otomatis** — semua penyesuaian stok dicatat manual dengan riwayat.
- **Pelanggan & Piutang**: Mendukung pembayaran cicilan (sebagian) maupun lunas, riwayat pembayaran tersendiri, cetak bukti bayar, tanpa menghapus riwayat piutang.
- **Pengeluaran & Akuntansi Akurat**: 11 kategori pengeluaran terklasifikasi menjadi *Pembelian Persediaan (Stok)*, *Biaya Operasional*, dan *Pengambilan Pemilik (Pribadi/Prive)*.
- **9 Laporan Keuangan + Ekspor PDF & Excel**: Penjualan harian/bulanan/tahunan, pengeluaran, piutang, stok, laba kotor, laba bersih, dan arus kas.
- **Audit Log & Pengaturan Toko**: Catat aktivitas/login pengguna, ubah nama toko kapan saja, logo, saldo awal kas, header/footer struk, dan cadangan data JSON.

## Panduan Setup Supabase
1. Buat proyek baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor → New Query**, salin seluruh isi file `supabase/schema.sql`, lalu klik **Run**.
3. Buat akun Pemilik (Owner) pertama di **Authentication → Users → Add user**.
4. Salin `User UID` akun tersebut, lalu jalankan query berikut di SQL Editor:
   ```sql
   INSERT INTO public.users (id, email, full_name, role, is_active, permissions)
   VALUES (
     'GANTI-DENGAN-UUID-AUTH-USER',
     'owner@tokoanda.com',
     'Pemilik Zhie Catshop',
     'owner',
     true,
     '{"can_view_cost_price": true, "can_record_expense": true, "can_manage_customers": true, "can_receive_receivable_payment": true}'::jsonb
   );
   ```
5. (Opsional untuk membuat akun kasir langsung dari menu Manajemen Pengguna) Deploy Edge Function:
   ```bash
   supabase functions deploy manage-users
   ```
6. Salin `.env.example` menjadi `.env` dan isi:
   ```env
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

## Menjalankan & Deploy
```bash
npm install
npm run dev      # Mode pengembangan
npm run build    # Build produksi (folder dist/)
```
Deploy folder proyek ini langsung ke **Vercel**, **Netlify**, atau **Cloudflare Pages** (set Environment Variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`), lalu buka dari Chrome/Safari di HP dan pilih **Tambahkan ke Layar Utama (Install App)**.
