-- 0001_schema.sql : tabel inti sistem daily reporting Area 19
-- Satuan uang: Rupiah (numeric). Tanggal laporan memakai zona waktu Asia/Jakarta di sisi aplikasi.

create type app_role as enum ('store', 'area_manager', 'admin');
create type store_type as enum ('mall', 'stand_alone', 'shophouse', 'hokben_kitchen');

-- ---------------------------------------------------------------- master
create table stores (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,            -- A01, A02, C82, ...
  name        text not null,
  short_name  text not null,                   -- label pendek di dashboard (MBK, PICON, ...)
  type        store_type not null,
  area        smallint not null default 19,
  phone_ext   text,
  pic_name    text,
  pic_phone   text,                            -- untuk reminder WA; data pribadi, jaga repo tetap private
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  role        app_role not null default 'store',
  store_id    uuid references stores(id),      -- wajib untuk role store, null untuk admin/area_manager
  created_at  timestamptz not null default now(),
  constraint store_role_needs_store check (role <> 'store' or store_id is not null)
);

-- Konstanta yang bisa diatur admin tanpa deploy ulang
create table settings (
  key         text primary key,
  value       numeric not null,
  description text
);
insert into settings (key, value, description) values
  ('man_hour_per_shift',     6.5,  'Jam kerja per orang (CL+TMBS dan Honorer) per hari; sama dengan rumus di Excel'),
  ('man_hour_part_time',     4,    'Jam kerja per orang part time per hari'),
  ('eom_safe_pct',           1.00, 'Status AMAN bila estimasi akhir bulan >= nilai ini x target bulan'),
  ('store_edit_window_days', 3,    'Store boleh mengisi/mengubah laporan s.d. N hari ke belakang'),
  ('anomaly_multiplier',     3,    'Peringatan bila total sales hari ini > N x rata-rata 14 hari terakhir');

-- ---------------------------------------------------------------- target & histori
create table monthly_targets (                 -- target bulanan resmi (sheet TARGET SALES 2026)
  store_id      uuid references stores(id) on delete cascade,
  month         date not null check (month = date_trunc('month', month)::date),
  target_sales  numeric not null check (target_sales >= 0),
  target_tc     numeric,
  primary key (store_id, month)
);

create table daily_targets (                   -- target harian berbobot (sheet TARGET PERDAY)
  store_id      uuid references stores(id) on delete cascade,
  target_date   date not null,
  target_sales  numeric not null check (target_sales >= 0),
  target_tc     numeric,                       -- opsional: tidak semua store punya
  target_cfb    int,
  primary key (store_id, target_date)
);

-- Rekap bulanan lampau (2025 penuh, 2026 s.d. Oktober). Dipakai untuk growth.
-- Bulan berjalan dihitung dari daily_reports, bukan dari tabel ini.
create table monthly_history (
  store_id           uuid references stores(id) on delete cascade,
  month              date not null check (month = date_trunc('month', month)::date),
  target_sales       numeric not null default 0,
  birthday           numeric not null default 0,
  dine_in            numeric not null default 0,
  delivery_hokben    numeric not null default 0,
  expo               numeric not null default 0,
  take_away          numeric not null default 0,
  drive_thru         numeric not null default 0,
  gofood             numeric not null default 0,
  grab               numeric not null default 0,
  shopee             numeric not null default 0,
  actual_sales       numeric generated always as
    (birthday + dine_in + delivery_hokben + expo + take_away + drive_thru + gofood + grab + shopee) stored,
  target_tc          numeric not null default 0,
  tc_birthday        int not null default 0,
  tc_dine_in         int not null default 0,
  tc_delivery_hokben int not null default 0,
  tc_expo            int not null default 0,
  tc_take_away       int not null default 0,
  tc_drive_thru      int not null default 0,
  tc_gofood          int not null default 0,
  tc_grab            int not null default 0,
  tc_shopee          int not null default 0,
  actual_tc          int generated always as
    (tc_birthday + tc_dine_in + tc_delivery_hokben + tc_expo + tc_take_away + tc_drive_thru
     + tc_gofood + tc_grab + tc_shopee) stored,
  primary key (store_id, month)
);

-- ---------------------------------------------------------------- laporan harian
-- FINAL: satu baris per store per tanggal (input malam hari). Sumber angka resmi.
create table daily_reports (
  store_id           uuid not null references stores(id),
  report_date        date not null,
  -- sales per layanan
  birthday           numeric not null default 0 check (birthday >= 0),
  dine_in            numeric not null default 0 check (dine_in >= 0),
  delivery_hokben    numeric not null default 0 check (delivery_hokben >= 0),
  expo               numeric not null default 0 check (expo >= 0),
  take_away          numeric not null default 0 check (take_away >= 0),
  drive_thru         numeric not null default 0 check (drive_thru >= 0),
  gofood             numeric not null default 0 check (gofood >= 0),
  grab               numeric not null default 0 check (grab >= 0),
  shopee             numeric not null default 0 check (shopee >= 0),
  total_sales        numeric generated always as
    (birthday + dine_in + delivery_hokben + expo + take_away + drive_thru + gofood + grab + shopee) stored,
  -- transaction count per layanan
  tc_birthday        int not null default 0 check (tc_birthday >= 0),
  tc_dine_in         int not null default 0 check (tc_dine_in >= 0),
  tc_delivery_hokben int not null default 0 check (tc_delivery_hokben >= 0),
  tc_expo            int not null default 0 check (tc_expo >= 0),
  tc_take_away       int not null default 0 check (tc_take_away >= 0),
  tc_drive_thru      int not null default 0 check (tc_drive_thru >= 0),
  tc_gofood          int not null default 0 check (tc_gofood >= 0),
  tc_grab            int not null default 0 check (tc_grab >= 0),
  tc_shopee          int not null default 0 check (tc_shopee >= 0),
  total_tc           int generated always as
    (tc_birthday + tc_dine_in + tc_delivery_hokben + tc_expo + tc_take_away + tc_drive_thru
     + tc_gofood + tc_grab + tc_shopee) stored,
  -- SDM harian (man hour dihitung di view v_daily_full memakai tabel settings)
  tms                int not null default 0 check (tms >= 0),
  cl_tmbs            int not null default 0 check (cl_tmbs >= 0),
  honorer            int not null default 0 check (honorer >= 0),
  part_time          int not null default 0 check (part_time >= 0),
  -- waste & lost (Rupiah). Konvensi file Excel: waste positif, lost negatif.
  waste              numeric not null default 0 check (waste >= 0),
  lost               numeric not null default 0 check (lost <= 0),
  -- CFB (target ada di daily_targets.target_cfb)
  cfb_di             int not null default 0 check (cfb_di >= 0),
  cfb_ta             int not null default 0 check (cfb_ta >= 0),
  notes              text,
  source             text not null default 'app' check (source in ('app', 'import')),
  submitted_by       uuid references auth.users,
  submitted_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (store_id, report_date)
);
create index on daily_reports (report_date);

-- SEMENTARA: update s.d. jam 15.00 dst (menggantikan list manual di grup WA). Boleh banyak per hari.
create table interim_updates (
  id                 bigint generated always as identity primary key,
  store_id           uuid not null references stores(id),
  report_date        date not null,
  cutoff_time        time not null,            -- mis. 15:00
  birthday           numeric not null default 0 check (birthday >= 0),
  dine_in            numeric not null default 0 check (dine_in >= 0),
  delivery_hokben    numeric not null default 0 check (delivery_hokben >= 0),
  expo               numeric not null default 0 check (expo >= 0),
  take_away          numeric not null default 0 check (take_away >= 0),
  drive_thru         numeric not null default 0 check (drive_thru >= 0),
  gofood             numeric not null default 0 check (gofood >= 0),
  grab               numeric not null default 0 check (grab >= 0),
  shopee             numeric not null default 0 check (shopee >= 0),
  total_sales        numeric generated always as
    (birthday + dine_in + delivery_hokben + expo + take_away + drive_thru + gofood + grab + shopee) stored,
  submitted_by       uuid references auth.users,
  submitted_at       timestamptz not null default now()
);
create index on interim_updates (store_id, report_date, submitted_at desc);

-- ---------------------------------------------------------------- kontrol & audit
create table period_locks (
  month      date primary key check (month = date_trunc('month', month)::date),
  locked_by  uuid references auth.users,
  locked_at  timestamptz not null default now()
);

create table audit_logs (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_key  text not null,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index on audit_logs (table_name, changed_at desc);

create table export_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  config      jsonb not null,                  -- jenis laporan, filter store/tipe, preset periode
  created_by  uuid references auth.users,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- trigger
-- Profil dibuat otomatis saat user dibuat (lihat scripts/create_users.mjs).
-- raw_user_meta_data: { "role": "store", "store_code": "A01", "full_name": "..." } (opsional)
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r   app_role := coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'store');
  sid uuid     := (select s.id from stores s where s.code = new.raw_user_meta_data ->> 'store_code');
begin
  -- Akun yang dibuat manual lewat dashboard Supabase tidak membawa metadata: profil dihubungkan
  -- kemudian lewat supabase/sql/link_accounts.sql (lihat tutorial). Jangan gagalkan pembuatan akunnya.
  if r = 'store' and sid is null then
    return new;
  end if;
  insert into profiles (id, full_name, role, store_id)
  values (new.id, new.raw_user_meta_data ->> 'full_name', r, sid);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger daily_reports_touch
  before update on daily_reports
  for each row execute function touch_updated_at();

-- Audit: dilewati bila app.skip_audit = 'on' (dipakai seed.sql)
create function write_audit() returns trigger language plpgsql security definer set search_path = public as $$
declare
  row_json jsonb;
begin
  if coalesce(current_setting('app.skip_audit', true), '') = 'on' then
    return null;  -- trigger AFTER: nilai kembalian diabaikan
  end if;
  row_json := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into audit_logs (table_name, record_key, action, old_data, new_data, changed_by)
  values (tg_table_name,
          (row_json ->> 'store_id') || ':' || (row_json ->> 'report_date'),
          tg_op,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
          auth.uid());
  return null;
end $$;

create trigger daily_reports_audit
  after insert or update or delete on daily_reports
  for each row execute function write_audit();
