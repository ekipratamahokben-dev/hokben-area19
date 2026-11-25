-- 0002_rls.sql : hak akses per peran
--   store         : isi & lihat data store sendiri (dalam jendela edit, periode belum dikunci)
--   area_manager  : baca semua store, tidak bisa mengubah apa pun
--   admin         : kelola semua, kecuali mengubah laporan pada periode yang dikunci

-- ---------------------------------------------------------------- helper
create function today_jkt() returns date language sql stable as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;

create function my_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create function my_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from profiles where id = auth.uid()
$$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'admin', false)
$$;

create function can_read_all() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('admin', 'area_manager'), false)
$$;

create function is_period_locked(d date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from period_locks where month = date_trunc('month', d)::date)
$$;

-- Store boleh menulis laporan miliknya sendiri untuk tanggal dalam jendela edit dan periode belum dikunci
create function store_can_write(p_store uuid, p_date date) returns boolean
language sql stable security definer set search_path = public as $$
  select my_role() = 'store'
     and my_store_id() = p_store
     and p_date <= today_jkt()
     and p_date >= today_jkt() - (select value::int from settings where key = 'store_edit_window_days')
     and not is_period_locked(p_date)
$$;

-- ---------------------------------------------------------------- aktifkan RLS
alter table stores           enable row level security;
alter table profiles         enable row level security;
alter table settings         enable row level security;
alter table monthly_targets  enable row level security;
alter table daily_targets    enable row level security;
alter table monthly_history  enable row level security;
alter table daily_reports    enable row level security;
alter table interim_updates  enable row level security;
alter table period_locks     enable row level security;
alter table audit_logs       enable row level security;
alter table export_templates enable row level security;

-- ---------------------------------------------------------------- master & referensi
create policy stores_read   on stores   for select to authenticated using (true);
create policy stores_admin  on stores   for all    to authenticated using (is_admin()) with check (is_admin());

create policy settings_read  on settings for select to authenticated using (true);
create policy settings_admin on settings for all    to authenticated using (is_admin()) with check (is_admin());

create policy locks_read  on period_locks for select to authenticated using (true);
create policy locks_admin on period_locks for all    to authenticated using (is_admin()) with check (is_admin());

create policy profiles_read  on profiles for select to authenticated using (id = auth.uid() or can_read_all());
create policy profiles_admin on profiles for all    to authenticated using (is_admin()) with check (is_admin());

-- target & histori: store melihat miliknya, area manager/admin melihat semua, hanya admin yang mengubah
create policy mt_read  on monthly_targets for select to authenticated using (can_read_all() or store_id = my_store_id());
create policy mt_admin on monthly_targets for all    to authenticated using (is_admin()) with check (is_admin());

create policy dt_read  on daily_targets for select to authenticated using (can_read_all() or store_id = my_store_id());
create policy dt_admin on daily_targets for all    to authenticated using (is_admin()) with check (is_admin());

create policy mh_read  on monthly_history for select to authenticated using (can_read_all() or store_id = my_store_id());
create policy mh_admin on monthly_history for all    to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------- laporan final
create policy dr_read on daily_reports for select to authenticated
  using (can_read_all() or store_id = my_store_id());

create policy dr_store_insert on daily_reports for insert to authenticated
  with check (store_can_write(store_id, report_date));

create policy dr_store_update on daily_reports for update to authenticated
  using (store_can_write(store_id, report_date))
  with check (store_can_write(store_id, report_date));

create policy dr_admin_insert on daily_reports for insert to authenticated
  with check (is_admin() and not is_period_locked(report_date));

create policy dr_admin_update on daily_reports for update to authenticated
  using (is_admin() and not is_period_locked(report_date))
  with check (is_admin() and not is_period_locked(report_date));

create policy dr_admin_delete on daily_reports for delete to authenticated
  using (is_admin() and not is_period_locked(report_date));

-- ---------------------------------------------------------------- update sementara (append-only untuk store)
create policy iu_read on interim_updates for select to authenticated
  using (can_read_all() or store_id = my_store_id());

create policy iu_store_insert on interim_updates for insert to authenticated
  with check (
    my_role() = 'store' and store_id = my_store_id()
    and report_date = today_jkt() and not is_period_locked(report_date)
  );

create policy iu_admin on interim_updates for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------- audit & template
create policy audit_admin_read on audit_logs for select to authenticated using (is_admin());
create policy templates_admin  on export_templates for all to authenticated
  using (is_admin()) with check (is_admin());
