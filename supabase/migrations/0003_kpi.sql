-- 0003_kpi.sql : semua angka laporan dihitung di database, supaya dashboard dan export Excel
-- memakai angka yang sama. Rumus sudah diuji terhadap laporan MTD 22 November 2026 (Image 1).
--
-- Rumus (sama dengan Excel):
--   avg_per_day       = actual_mtd / hari_berjalan
--   pct_achievement   = actual_mtd / target_mtd           (target_mtd = jumlah target harian berbobot)
--   pct_countdown     = actual_mtd / target_bulan         (kolom "% MTD / Progres")
--   est_eom           = avg_per_day x hari_dalam_bulan
--   gap_eom           = est_eom - target_bulan            (kolom "Selisih")
--   gap_per_day       = gap_eom / sisa_hari               (kolom "Selisih perday")
--   required_per_day  = (target_bulan - actual_mtd) / sisa_hari   (kolom "Target/day to achieve 100%")
--   growth            = avg_per_day / (sales bulan sama tahun lalu / hari bulan itu) - 1
--   TCMH              = total TC / man hour; man hour = (CL+TMBS + Honorer) x 6,5 + Part time x 4
--   status            = AMAN bila est_eom >= target_bulan x settings.eom_safe_pct

-- ---------------------------------------------------------------- view harian lengkap
create view v_daily_full with (security_invoker = true) as
select x.*,
       case when x.man_hours > 0 then x.total_tc::numeric / x.man_hours end as tcmh
from (
  select r.store_id, s.code as store_code, s.short_name, s.name as store_name, s.type as store_type,
         r.report_date,
         dt.target_sales, dt.target_tc, dt.target_cfb,
         r.total_sales,
         case when dt.target_sales > 0 then r.total_sales / dt.target_sales end as pct_achievement,
         r.birthday, r.dine_in, r.delivery_hokben, r.expo, r.take_away, r.drive_thru,
         r.gofood, r.grab, r.shopee,
         r.gofood + r.grab + r.shopee as ojol_sales,
         r.tc_birthday, r.tc_dine_in, r.tc_delivery_hokben, r.tc_expo, r.tc_take_away,
         r.tc_drive_thru, r.tc_gofood, r.tc_grab, r.tc_shopee, r.total_tc,
         r.tms, r.cl_tmbs, r.honorer, r.part_time,
         (r.cl_tmbs + r.honorer) * (select value from settings where key = 'man_hour_per_shift')
           + r.part_time * (select value from settings where key = 'man_hour_part_time') as man_hours,
         r.waste, r.lost, r.cfb_di, r.cfb_ta, r.notes, r.source, r.submitted_at, r.updated_at
  from daily_reports r
  join stores s on s.id = r.store_id
  left join daily_targets dt on dt.store_id = r.store_id and dt.target_date = r.report_date
) x;

-- Sales harian efektif: angka final bila ada; kalau belum, update sementara terakhir (ditandai provisional)
create view v_daily_sales with (security_invoker = true) as
select store_id, report_date, total_sales, false as is_provisional from daily_reports
union all
select store_id, report_date, total_sales, true as is_provisional
from (
  select distinct on (i.store_id, i.report_date) i.store_id, i.report_date, i.total_sales
  from interim_updates i
  where not exists (select 1 from daily_reports r
                    where r.store_id = i.store_id and r.report_date = i.report_date)
  order by i.store_id, i.report_date, i.submitted_at desc
) q;

-- ---------------------------------------------------------------- KPI MTD per store
create function kpi_mtd(p_month date, p_through date default null)
returns table (
  store_id uuid, store_code text, short_name text, store_name text, store_type store_type,
  days_in_month int, days_elapsed int, days_left int,
  target_month numeric, target_mtd numeric, actual_mtd numeric, provisional_days int,
  avg_per_day numeric, pct_achievement numeric, pct_countdown numeric,
  est_eom numeric, pct_est_eom numeric, gap_eom numeric, gap_per_day numeric, required_per_day numeric,
  ly_month_sales numeric, growth_pct numeric,
  total_tc bigint, man_hours numeric, tcmh numeric, waste numeric, lost numeric,
  status text
)
language sql stable as $$
  with cal as (
    select date_trunc('month', p_month)::date as m0,
           (date_trunc('month', p_month) + interval '1 month - 1 day')::date as m_end,
           least(coalesce(p_through, today_jkt()),
                 (date_trunc('month', p_month) + interval '1 month - 1 day')::date) as thru
  ), c as (
    select m0, thru,
           extract(day from m_end)::int as dim,
           (thru - m0 + 1) as elapsed,
           extract(day from (m0 - interval '1 year' + interval '1 month - 1 day'))::int as ly_dim
    from cal
  ), act as (
    select v.store_id, sum(v.total_sales) as amt, count(*) filter (where v.is_provisional)::int as prov
    from v_daily_sales v, c
    where v.report_date between c.m0 and c.thru
    group by v.store_id
  ), tgt as (
    select d.store_id, sum(d.target_sales) as amt
    from daily_targets d, c
    where d.target_date between c.m0 and c.thru
    group by d.store_id
  ), ops as (
    select f.store_id, sum(f.total_tc) as tc, sum(f.man_hours) as mh, sum(f.waste) as waste, sum(f.lost) as lost
    from v_daily_full f, c
    where f.report_date between c.m0 and c.thru
    group by f.store_id
  ), base as (
    select s.id, s.code, s.short_name, s.name, s.type,
           c.dim, c.elapsed::int as elapsed, (c.dim - c.elapsed)::int as days_left,
           coalesce(mt.target_sales, 0) as target_month,
           coalesce(tgt.amt, coalesce(mt.target_sales, 0) * c.elapsed / c.dim) as target_mtd,
           coalesce(act.amt, 0) as actual_mtd,
           coalesce(act.prov, 0) as prov,
           coalesce(act.amt, 0) / nullif(c.elapsed, 0) as avg_day,
           h.actual_sales as ly_sales, c.ly_dim,
           ops.tc, ops.mh, ops.waste, ops.lost
    from stores s
    cross join c
    left join monthly_targets mt on mt.store_id = s.id and mt.month = c.m0
    left join monthly_history h on h.store_id = s.id and h.month = (c.m0 - interval '1 year')::date
    left join act on act.store_id = s.id
    left join tgt on tgt.store_id = s.id
    left join ops on ops.store_id = s.id
    where s.is_active and (auth.uid() is null or can_read_all() or s.id = my_store_id())
  )
  select b.id, b.code, b.short_name, b.name, b.type,
         b.dim, b.elapsed, b.days_left,
         b.target_month, b.target_mtd, b.actual_mtd, b.prov,
         b.avg_day,
         b.actual_mtd / nullif(b.target_mtd, 0),
         b.actual_mtd / nullif(b.target_month, 0),
         b.avg_day * b.dim,
         b.avg_day * b.dim / nullif(b.target_month, 0),
         b.avg_day * b.dim - b.target_month,
         (b.avg_day * b.dim - b.target_month) / nullif(b.days_left, 0),
         (b.target_month - b.actual_mtd) / nullif(b.days_left, 0),
         b.ly_sales,
         b.avg_day / nullif(b.ly_sales / b.ly_dim, 0) - 1,
         coalesce(b.tc, 0)::bigint, coalesce(b.mh, 0), b.tc / nullif(b.mh, 0),
         coalesce(b.waste, 0), coalesce(b.lost, 0),
         case when b.avg_day * b.dim >= b.target_month * (select value from settings where key = 'eom_safe_pct')
              then 'AMAN' else 'TIDAK AMAN' end
  from base b
  order by b.code
$$;

-- ---------------------------------------------------------------- KPI MTD total area
create function kpi_area_mtd(p_month date, p_through date default null)
returns table (
  days_in_month int, days_elapsed int, days_left int,
  target_month numeric, target_mtd numeric, actual_mtd numeric,
  avg_per_day numeric, pct_achievement numeric, pct_countdown numeric,
  est_eom numeric, pct_est_eom numeric, gap_eom numeric, gap_per_day numeric, required_per_day numeric,
  ly_month_sales numeric, growth_pct numeric,
  total_tc bigint, man_hours numeric, tcmh numeric, waste numeric, lost numeric,
  status text
)
language sql stable as $$
  with k as (select * from kpi_mtd(p_month, p_through)),
  a as (
    select max(days_in_month) as dim, max(days_elapsed) as elapsed, max(days_left) as days_left,
           sum(target_month) as tm, sum(target_mtd) as tmtd, sum(actual_mtd) as act,
           sum(est_eom) as eom, sum(ly_month_sales) as ly,
           sum(total_tc) as tc, sum(man_hours) as mh, sum(waste) as waste, sum(lost) as lost
    from k
  )
  select a.dim, a.elapsed, a.days_left,
         a.tm, a.tmtd, a.act,
         a.act / nullif(a.elapsed, 0),
         a.act / nullif(a.tmtd, 0),
         a.act / nullif(a.tm, 0),
         a.eom, a.eom / nullif(a.tm, 0), a.eom - a.tm,
         (a.eom - a.tm) / nullif(a.days_left, 0),
         (a.tm - a.act) / nullif(a.days_left, 0),
         a.ly,
         (a.act / nullif(a.elapsed, 0)) /
           nullif(a.ly / extract(day from (date_trunc('month', p_month) - interval '1 year' + interval '1 month - 1 day')), 0) - 1,
         a.tc::bigint, a.mh, a.tc / nullif(a.mh, 0), a.waste, a.lost,
         case when a.eom >= a.tm * (select value from settings where key = 'eom_safe_pct')
              then 'AMAN' else 'TIDAK AMAN' end
  from a
$$;

-- ---------------------------------------------------------------- monitoring: siapa sudah / belum lapor
create function report_status(p_date date default null)
returns table (
  store_code text, short_name text, pic_name text, pic_phone text,
  final_submitted boolean, interim_count int, last_interim_at timestamptz, last_interim_total numeric
)
language sql stable as $$
  select s.code, s.short_name, s.pic_name, s.pic_phone,
         exists (select 1 from daily_reports r
                 where r.store_id = s.id and r.report_date = coalesce(p_date, today_jkt())),
         (select count(*)::int from interim_updates i
          where i.store_id = s.id and i.report_date = coalesce(p_date, today_jkt())),
         (select max(i.submitted_at) from interim_updates i
          where i.store_id = s.id and i.report_date = coalesce(p_date, today_jkt())),
         (select i.total_sales from interim_updates i
          where i.store_id = s.id and i.report_date = coalesce(p_date, today_jkt())
          order by i.submitted_at desc limit 1)
  from stores s
  where s.is_active and (auth.uid() is null or can_read_all() or s.id = my_store_id())
  order by s.code
$$;
