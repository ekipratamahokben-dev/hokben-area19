# Daily Reporting Store — Area 19

Database Supabase (skema, hak akses, rumus KPI) yang **sudah berisi data dari Excel**: 13 store, target
Jan–Des 2026, target harian November, laporan harian 1–22 November 2026, dan histori bulanan 2025–2026.

## Isi repo

| Path | Fungsi |
|---|---|
| `supabase/migrations/0001_schema.sql` | Tabel, constraint, trigger (profil otomatis, audit, `updated_at`) |
| `supabase/migrations/0002_rls.sql` | Hak akses: store / area_manager / admin, jendela edit, kunci periode |
| `supabase/migrations/0003_kpi.sql` | View `v_daily_full`, `v_daily_sales`; fungsi `kpi_mtd`, `kpi_area_mtd`, `report_status` |
| `supabase/seed.sql` | Data dari Excel (dihasilkan skrip, jangan edit manual) |
| `supabase/verify.sql` | Query pembuktian: hasilnya harus sama dengan laporan Excel 22 Nov |
| `scripts/extract_seed.py` | Baca workbook → `data/seed_data.json` + `seed.sql`. Bisa dijalankan ulang |
| `scripts/create_users.mjs` | Buat 1 akun per store + admin, tulis `credentials.csv` |

## Setup (sekitar 15 menit)

1. Buat project di supabase.com (region Singapore paling dekat).
2. Hubungkan dan terapkan migrasi:
   ```bash
   npx supabase login
   npx supabase init                 # sekali saja; folder migrations tidak ditimpa
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```
3. Muat data awal. Ambil connection string di Supabase → **Connect**, lalu:
   ```bash
   psql "<CONNECTION_STRING>" -f supabase/seed.sql
   ```
4. Buat akun login:
   ```bash
   npm install
   cp .env.example .env              # isi URL, service role key, domain email, email admin
   npm run create-users
   ```
   Email store: `a01@<domain>`, `a02@<domain>`, … `c83@<domain>`. Password awal acak ada di `credentials.csv`.
5. Jalankan `supabase/verify.sql` di SQL Editor dan cocokkan dengan komentar di dalamnya.

> Repo ini berisi nama dan nomor HP PIC store. **Buat repo GitHub sebagai private.**
> `.env`, `credentials.csv`, dan `*.xlsx` sudah di-`.gitignore`.

## Menjalankan aplikasi web (Next.js)

```bash
npm install
# di .env isi juga NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_EMAIL_DOMAIN
npm run dev                         # http://localhost:3000 (di lokal, basePath kosong)
```
### Deploy ke GitHub Pages (hanya GitHub + Supabase)

Aplikasi ini situs statis: tidak butuh server. Semua data diambil browser langsung dari Supabase, dan
keamanannya dijaga login + aturan RLS di database.

1. Push kode ke GitHub (lihat catatan keamanan di bawah).
2. Repo > **Settings > Pages** > *Build and deployment* > Source: **GitHub Actions**.
3. Repo > **Settings > Secrets and variables > Actions > tab Variables** > **New repository variable**, buat tiga:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_EMAIL_DOMAIN`.
   (Pakai *Variables*, bukan Secrets. Jangan pernah memasukkan service role key ke GitHub.)
4. Repo > **Actions** > jalankan workflow *Deploy ke GitHub Pages* (atau cukup `git push`).
5. Alamat situs: `https://<username>.github.io/<nama-repo>/`.

**Catatan keamanan.** GitHub Pages di paket gratis hanya untuk repo **publik**. Karena itu `supabase/seed.sql`
dan folder `data/` (nama/HP PIC dan angka sales) sudah di-`.gitignore`: simpan di komputer, jangan masuk Git.
Kalau sebelumnya sudah sempat di-push, hapus repo itu dan buat repo baru. Repo private + Pages butuh paket GitHub berbayar;
kode ini berjalan sama persis di kedua kasus.

| Halaman | Untuk | Fungsi |
|---|---|---|
| `/login` | semua | Store cukup mengetik kode (mis. `A01`) dan password |
| `/input` | store, admin | Tab **Update sementara** (boleh berkali-kali, jam otomatis) dan **Laporan final** (sales, TC, crew, waste, lost, CFB, catatan). Total live, peringatan bila > 3x rata-rata 14 hari |
| `/dashboard` | semua (store hanya melihat dirinya) | Ringkasan area, tabel per store, status Aman/Tidak Aman, tombol **Salin format WA** |
| `/reports` | admin, area manager | Export .xlsx: Daily, MTD, Raw; periode bebas; filter tipe store |

**Belum ada di aplikasi** (database sudah siap): halaman admin untuk target/user/kunci periode/audit
(sementara lewat SQL Editor Supabase), import target dari Excel, grafik, reminder otomatis, simpan template export.
Kode JSX **belum pernah dikompilasi** di lingkungan pembuatnya; jalankan `npm run build` dulu dan laporkan error bila ada.

## Hasil verifikasi data (dilakukan saat seed dibuat)

Dihitung dari data yang diekstrak dan dibandingkan dengan laporan Excel 22 November 2026:

| Ukuran | Hasil ekstraksi | Laporan Excel |
|---|---|---|
| Actual MTD area (1–22 Nov) | 4.244.373.480 | 4.244.373.480 |
| Actual harian 22 Nov | 266.581.706 | 266.581.706 |
| Target MTD area | 4.327.365.066 | 4.327.365.066 |
| Target bulan Nov | 5.846.872.017 | 5.846.872.017 |
| Estimasi EOM area | 5.787.782.018 | 5.787.782.018 |

Rumus KPI (EOM, selisih, target/hari, TCMH) juga cocok per store untuk store yang dicek di Image 1.
Kode SQL **belum dijalankan di Postgres** (tidak tersedia di lingkungan pembuatnya): langkah 5 adalah uji pertamanya.

## Keputusan data yang perlu kamu tahu

- **Target MTD** memakai jumlah target harian berbobot (sheet TARGET PERDAY), sama dengan Image 1.
- **Man hour** = (CL+TMBS + Honorer) × 6,5 + Part time × 4; TMS tidak dihitung. Angka 6,5 dan 4 ada di tabel `settings`.
- **TCMH** = total TC ÷ man hour.
- **Status AMAN** = estimasi EOM ≥ target bulan (`settings.eom_safe_pct`). Aturan ini tebakan dari Image 4; ubah bila beda.
- **Lost** disimpan negatif (konvensi Excel). 5 baris PSM (16–20 Nov) bertanda positif di Excel, dibalik menjadi negatif.
- **Target/day to achieve 100%** (`required_per_day`) disimpan positif; di Excel tampil negatif dalam kurung.
- **Target TC** hanya ada sebagian di Excel (tidak ada untuk tgl 23–30 dan beberapa store), jadi dibiarkan kosong.
- **CFB** (`cfb_di`, `cfb_ta`, target `target_cfb`) diimpor apa adanya; artinya belum dikonfirmasi.
- **Tidak diimpor**: sheet tersembunyi Lubuk Linggau dan Pringsewu, serta data dashboard lain di workbook.
- `interim_updates` (update jam 15.00) kosong; data WA lama tidak ada di workbook.
- Growth = sales per hari bulan ini vs rata-rata per hari **bulan yang sama tahun lalu** (Nov 2026 vs Nov 2025).
