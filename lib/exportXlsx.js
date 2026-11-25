// Membuat file Excel langsung di browser (tanpa server). Data diambil lewat Supabase sehingga
// hak akses (RLS) tetap berlaku: akun yang tidak berhak tidak akan mendapat data.
const RP = "#,##0", PC = "0.0%", D2 = "0.00";

// [judul kolom, kunci, format angka]
const HARIAN = [
  ["Tanggal", "report_date"], ["Kode", "store_code"], ["Store", "short_name"], ["Target", "target_sales", RP],
  ["Actual", "total_sales", RP], ["%", "pct_achievement", PC], ["Dine in", "dine_in", RP], ["Take away", "take_away", RP],
  ["Delivery Hokben", "delivery_hokben", RP], ["GoFood", "gofood", RP], ["Grab", "grab", RP], ["Shopee", "shopee", RP],
  ["Birthday", "birthday", RP], ["Expo", "expo", RP], ["Drive thru", "drive_thru", RP], ["TC", "total_tc", RP],
  ["TCMH", "tcmh", D2], ["Waste", "waste", RP], ["Lost", "lost", RP],
];
const MTD = [
  ["Kode", "store_code"], ["Store", "short_name"], ["Target bulan", "target_month", RP], ["Target MTD", "target_mtd", RP],
  ["Actual MTD", "actual_mtd", RP], ["% achievement", "pct_achievement", PC], ["% countdown", "pct_countdown", PC],
  ["Avg/hari", "avg_per_day", RP], ["Estimasi akhir bulan", "est_eom", RP], ["% estimasi", "pct_est_eom", PC],
  ["Selisih estimasi", "gap_eom", RP], ["Selisih per hari", "gap_per_day", RP], ["Perlu per hari (100%)", "required_per_day", RP],
  ["Sales bulan sama tahun lalu", "ly_month_sales", RP], ["Growth", "growth_pct", PC], ["TC", "total_tc", RP],
  ["Man hour", "man_hours", D2], ["TCMH", "tcmh", D2], ["Waste", "waste", RP], ["Lost", "lost", RP], ["Status", "status"],
];
const SUM_COLS = new Set(["target_sales", "total_sales", "dine_in", "take_away", "delivery_hokben", "gofood", "grab", "shopee",
  "birthday", "expo", "drive_thru", "total_tc", "waste", "lost"]);

function addSheet(wb, name, cols, rows, withTotal) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map(([h, k, fmt]) => ({ header: h, key: k, width: Math.max(11, h.length + 2), style: fmt ? { numFmt: fmt } : {} }));
  rows.forEach((r) => ws.addRow(r));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12263F" } };
  head.alignment = { vertical: "middle", wrapText: true };
  if (withTotal && rows.length) {
    const last = rows.length + 1;
    const t = ws.addRow({ short_name: "TOTAL" });
    cols.forEach(([, k], i) => {
      if (SUM_COLS.has(k)) { const L = ws.getColumn(i + 1).letter; t.getCell(i + 1).value = { formula: `SUM(${L}2:${L}${last})` }; }
    });
    t.font = { bold: true };
  }
}

export async function buildExport(sb, { type, from, to, group }) {
  const mod = await import("exceljs/dist/exceljs.min.js");   // versi untuk browser
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();

  if (type === "mtd") {
    const { data, error } = await sb.rpc("kpi_mtd", { p_month: to.slice(0, 7) + "-01", p_through: to });
    if (error) throw error;
    addSheet(wb, "MTD", MTD, group ? data.filter((r) => r.store_type === group) : data, false);
  } else {
    let q = sb.from("v_daily_full").select("*").gte("report_date", from).lte("report_date", to)
      .order("report_date").order("store_code");
    if (group) q = q.eq("store_type", group);
    const { data, error } = await q.range(0, 9999);            // batas 10.000 baris
    if (error) throw error;
    if (type === "raw") {
      const keys = data.length ? Object.keys(data[0]).filter((k) => k !== "store_id") : [];
      addSheet(wb, "Raw", keys.map((k) => [k, k]), data, false);
    } else addSheet(wb, "Daily", HARIAN, data, true);
  }
  const buf = await wb.xlsx.writeBuffer();
  return {
    blob: new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename: `area19_${type}_${from}_${to}.xlsx`,
  };
}
