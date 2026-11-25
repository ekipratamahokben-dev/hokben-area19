-- verify.sql : jalankan di SQL Editor Supabase SETELAH migrasi dan seed.
-- Setiap hasil harus cocok dengan laporan Excel 22 November 2026.

-- 1) Jumlah baris seed. Harapan: 13 | 156 | 390 | 286 | 286
select (select count(*) from stores)           as stores,
       (select count(*) from monthly_targets)  as monthly_targets,
       (select count(*) from daily_targets)    as daily_targets,
       (select count(*) from daily_reports)    as daily_reports,
       (select count(*) from monthly_history)  as monthly_history;

-- 2) Total area MTD 1-22 Nov (Image 1).
-- Harapan: target_month 5.846.872.017 | target_mtd 4.327.365.066 | actual_mtd 4.244.373.480
--          pct_achievement 0,9808 | pct_countdown 0,726 | est_eom 5.787.782.018 | status TIDAK AMAN
select * from kpi_area_mtd('2026-11-01', '2026-11-22');

-- 3) Per store (Image 1). Contoh baris A01 MBK: target_mtd 508.929.019 | actual 547.017.225
--    est_eom 745.932.580 | gap_eom 60.044.408 | required_per_day 17.358.868 | tcmh 4,87
select store_code, short_name, target_mtd, actual_mtd, pct_achievement, est_eom,
       gap_eom, gap_per_day, required_per_day, growth_pct, round(tcmh, 2) as tcmh, status
from kpi_mtd('2026-11-01', '2026-11-22');

-- 4) Laporan harian 22 Nov (Image 2). Harapan total_sales area: 266.581.706
select sum(target_sales) as target, sum(total_sales) as actual, sum(total_sales) / sum(target_sales) as pct
from v_daily_full where report_date = '2026-11-22';
