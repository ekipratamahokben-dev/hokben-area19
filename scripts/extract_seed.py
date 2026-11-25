#!/usr/bin/env python3
"""
Ekstrak data dari workbook "SALES AREA 19" ke data/seed_data.json lalu
supabase/seed.sql. Jalankan ulang kapan saja workbook diperbarui:

    python scripts/extract_seed.py path/ke/workbook.xlsx

Sumber data (dibaca sebagai nilai hasil hitung, bukan rumus):
  LINK SALES          -> kode, nama, ext, PIC store
  TARGET SALES 2026   -> target bulanan resmi per store (Jan-Des)
  sheet 01..13        -> harian (baris 7-37), target harian, SDM, waste/lost,
                         rekap bulanan 2026 (baris 47-58) dan 2025 (baris 67-78)
"""
import sys, json, datetime as dt
from pathlib import Path
from openpyxl import load_workbook

SRC = sys.argv[1] if len(sys.argv) > 1 else "workbook.xlsx"
ROOT = Path(__file__).resolve().parent.parent
LAST_REPORTED = dt.date(2026, 11, 22)  # hari terakhir yang sudah terisi final

# sheet -> (kode, tipe, nama di TARGET SALES 2026)
STORES = {
    "01. MBK":             ("A01", "mall",           "MALL BOEMI KEDATON"),
    "02. PICON":           ("A02", "mall",           "PALEMBANG ICON"),
    "03. ANTASARI":        ("A03", "stand_alone",    "PANGERAN ANTASARI LAMPUNG"),
    "04. BENCOOLEN":       ("A11", "shophouse",      "HOKBEN RUKO BENCOOLEN BENGKULU"),
    "05. PLAJU":           ("A20", "shophouse",      "RUKO PLAJU PALEMBANG"),
    "06. SIMPANG BANDARA": ("A21", "shophouse",      "RUKO SIMPANG BANDARA MAS PALEMBANG"),
    "07. LCM":             ("A23", "mall",           "LAMPUNG CITY MALL"),
    "08. LAHAT":           ("A26", "mall",           "CITIMALL LAHAT"),
    "09. PSM":             ("A29", "mall",           "PALEMBANG SQUARE MALL"),
    "10. PANGKAL PINANG":  ("A33", "shophouse",      "SOEKARNO HATTA PANGKAL PINANG"),
    "11. BATURAJA":        ("A34", "mall",           "RAMAYANA BATURAJA OGAN KOMERING ULU"),
    "12. HBK PRABU":       ("C82", "hokben_kitchen", "HOKBEN KITCHEN PRABUMULIH"),
    "13. HBK DIPO":        ("C83", "hokben_kitchen", "HOKBEN KITCHEN DIPONEGORO BANDAR LAMPUNG"),
}
SHORT = {"A01": "MBK", "A02": "PICON", "A03": "ANTASARI", "A11": "BENCOOLEN", "A20": "PLAJU",
         "A21": "SIMPANG", "A23": "LCM", "A26": "LAHAT", "A29": "SQUARE", "A33": "PNP",
         "A34": "BATURAJA", "C82": "PRABU", "C83": "DIPO"}

CH = ["birthday", "dine_in", "delivery_hokben", "expo", "take_away", "drive_thru", "gofood", "grab", "shopee"]
COL_SALES = dict(zip(CH, range(9, 18)))          # I..Q  (harian)
COL_TC = dict(zip(CH, range(24, 33)))            # X..AF (harian)
COL_MONTH_SALES = dict(zip(CH, range(11, 20)))   # K..S  (blok bulanan)
COL_MONTH_TC = dict(zip(CH, range(26, 35)))      # Z..AH (blok bulanan)

wb = load_workbook(SRC, data_only=True)


def num(v):
    return 0 if v in (None, "") or isinstance(v, str) else float(v)


# ---------- LINK SALES: info store ----------
info = {}
ws = wb["LINK SALES"]
for r in range(4, 40):
    code = ws.cell(r, 5).value
    if isinstance(code, str) and len(code) == 3:
        info[code] = dict(name=ws.cell(r, 6).value, ext=str(ws.cell(r, 7).value or ""),
                          pic_name=ws.cell(r, 8).value, pic_phone=str(ws.cell(r, 9).value or ""))

# ---------- TARGET SALES 2026 ----------
ts = wb["TARGET SALES 2026"]
target_row = {}
for r in range(6, 20):
    n = ts.cell(r, 6).value
    if n:
        target_row[n.strip()] = [num(ts.cell(r, c).value) for c in range(7, 19)]  # G..R

# ---------- TARGET PERDAY: target sales harian sebulan penuh ----------
PERDAY_COL = {"MALL BOEMI KEDATON": "A01", "PALEMBANG ICON": "A02", "FSU ANTASARI": "A03",
              "HBK PRABUMULIH": "C82", "HBK DIPONEGORO": "C83", "BENCOOLEN": "A11", "PLAJU": "A20",
              "SIMPANG BANDARA": "A21", "LCM": "A23", "LAHAT": "A26", "PSM": "A29",
              "PANGKAL PINANG": "A33", "BATURAJA": "A34"}
tp = wb["TARGET PERDAY"]
perday = {}  # (kode, tanggal) -> target sales
for c in range(3, 19):
    code = PERDAY_COL.get(str(tp.cell(3, c).value).strip())
    if not code:
        continue
    for r in range(5, 40):
        d = tp.cell(r, 2).value
        if isinstance(d, dt.datetime):
            perday[(code, d.date())] = num(tp.cell(r, c).value)

stores, monthly_targets, daily_targets, daily_reports, history = [], [], [], [], []
warnings = []

for sheet, (code, typ, tname) in STORES.items():
    s = wb[sheet]
    stores.append(dict(code=code, name=info[code]["name"], short_name=SHORT[code], type=typ,
                       ext=info[code]["ext"], pic_name=info[code]["pic_name"],
                       pic_phone=info[code]["pic_phone"]))

    for m in range(12):  # target bulanan 2026 resmi + target TC dari blok 2026 (W47..W58)
        monthly_targets.append(dict(code=code, month=f"2026-{m+1:02d}-01",
                                    target_sales=target_row[tname][m],
                                    target_tc=num(s.cell(47 + m, 23).value) or None))

    for i in range(30):  # harian: baris 7..36 = tanggal 1..30 November (kolom tanggal kosong utk hari belum jalan)
        r = 7 + i
        d = dt.date(2026, 11, i + 1)
        tc_target = round(num(s.cell(r, 23).value), 2) or None   # kosong untuk hari yang belum jalan
        daily_targets.append(dict(code=code, target_date=d.isoformat(),
                                  target_sales=perday[(code, d)], target_tc=tc_target,
                                  target_cfb=int(num(s.cell(r, 42).value))))
        if d > LAST_REPORTED:
            continue
        row = dict(code=code, report_date=d.isoformat())
        for k, c in COL_SALES.items():
            row[k] = num(s.cell(r, c).value)
        for k, c in COL_TC.items():
            row["tc_" + k] = int(num(s.cell(r, c).value))
        waste, lost = num(s.cell(r, 20).value), num(s.cell(r, 21).value)
        if lost > 0:  # konvensi file: lost bernilai negatif; yang positif dianggap salah tanda
            warnings.append(f"{code} {d}: lost {lost:,.0f} bertanda positif -> dijadikan negatif")
            lost = -lost
        row.update(tms=int(num(s.cell(r, 35).value)), cl_tmbs=int(num(s.cell(r, 36).value)),
                   honorer=int(num(s.cell(r, 37).value)), part_time=int(num(s.cell(r, 38).value)),
                   waste=waste, lost=lost,
                   cfb_di=int(num(s.cell(r, 43).value)), cfb_ta=int(num(s.cell(r, 44).value)))
        daily_reports.append(row)

    # histori bulanan: 2026 Jan-Okt (baris 47..56) dan 2025 Jan-Des (baris 67..78)
    for year, base, n_months in ((2026, 47, 10), (2025, 67, 12)):
        for m in range(n_months):
            r = base + m
            h = dict(code=code, month=f"{year}-{m+1:02d}-01",
                     target_sales=num(s.cell(r, 8).value), actual_sales=num(s.cell(r, 9).value))
            for k, c in COL_MONTH_SALES.items():
                h[k] = num(s.cell(r, c).value)
            h["target_tc"] = num(s.cell(r, 23).value)
            h["actual_tc"] = int(num(s.cell(r, 24).value))
            for k, c in COL_MONTH_TC.items():
                h["tc_" + k] = int(num(s.cell(r, c).value))
            history.append(h)

# cek: target bulanan resmi vs jumlah target harian November
for st in stores:
    m = next(x for x in monthly_targets if x["code"] == st["code"] and x["month"] == "2026-11-01")["target_sales"]
    dsum = sum(x["target_sales"] for x in daily_targets if x["code"] == st["code"])
    if abs(m - dsum) > 1000:
        warnings.append(f"{st['code']} target Nov bulanan {m:,.0f} != jumlah harian {dsum:,.0f} (selisih {dsum-m:,.0f})")

data = dict(stores=stores, monthly_targets=monthly_targets, daily_targets=daily_targets,
            daily_reports=daily_reports, monthly_history=history)
(ROOT / "data").mkdir(exist_ok=True)
(ROOT / "data" / "seed_data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))


# ---------- tulis seed.sql ----------
def q(v):
    if v is None:
        return "null"
    if isinstance(v, str):
        return "'" + v.replace("'", "''") + "'"
    return repr(round(v, 4)) if isinstance(v, float) else str(v)


def insert(table, rows, conflict, skip=("code",)):
    cols = [c for c in rows[0] if c not in skip]
    head = f"insert into {table} (store_id, {', '.join(cols)}) values"
    vals = [f"  ((select id from stores where code='{r['code']}'), " +
            ", ".join(q(r[c]) for c in cols) + ")" for r in rows]
    return head + "\n" + ",\n".join(vals) + f"\non conflict {conflict} do nothing;\n"


sql = ["-- GENERATED oleh scripts/extract_seed.py -- jangan edit manual.",
       f"-- Sumber: {Path(SRC).name}; data harian s.d. {LAST_REPORTED}.",
       "begin;",
       "set local app.skip_audit = 'on';  -- jangan penuhi audit_logs dengan data awal\n",
       "insert into stores (code, name, short_name, type, area, phone_ext, pic_name, pic_phone) values",
       ",\n".join("  (" + ", ".join(q(x) for x in (s["code"], s["name"], s["short_name"], s["type"], 19,
                                                    s["ext"], s["pic_name"], s["pic_phone"])) + ")"
                 for s in stores),
       "on conflict (code) do nothing;\n",
       insert("monthly_targets", monthly_targets, "(store_id, month)"),
       insert("daily_targets", daily_targets, "(store_id, target_date)"),
       insert("monthly_history", history, "(store_id, month)", skip=("code", "actual_sales", "actual_tc")),
       insert("daily_reports", daily_reports, "(store_id, report_date)"),
       "update daily_reports set source = 'import' where submitted_by is null;",
       "commit;"]
(ROOT / "supabase" / "seed.sql").write_text("\n".join(sql))

print("\n".join("PERINGATAN: " + w for w in warnings))
print(f"stores={len(stores)} monthly_targets={len(monthly_targets)} daily_targets={len(daily_targets)} "
      f"daily_reports={len(daily_reports)} monthly_history={len(history)}")


# ---------- seed_parts: 4 file kecil yang bisa ditempel satu per satu di SQL Editor Supabase ----------
parts_dir = ROOT / "supabase" / "seed_parts"
parts_dir.mkdir(exist_ok=True)
stores_sql = ("insert into stores (code, name, short_name, type, area, phone_ext, pic_name, pic_phone) values\n" +
              ",\n".join("  (" + ", ".join(q(x) for x in (s["code"], s["name"], s["short_name"], s["type"], 19,
                                                           s["ext"], s["pic_name"], s["pic_phone"])) + ")" for s in stores) +
              "\non conflict (code) do nothing;\n")
PARTS = {
    "1_store_dan_target_bulanan": [stores_sql, insert("monthly_targets", monthly_targets, "(store_id, month)")],
    "2_target_harian_november": [insert("daily_targets", daily_targets, "(store_id, target_date)")],
    "3_histori_2025_2026": [insert("monthly_history", history, "(store_id, month)", skip=("code", "actual_sales", "actual_tc"))],
    "4_laporan_harian_november": [insert("daily_reports", daily_reports, "(store_id, report_date)"),
                                  "update daily_reports set source = 'import' where submitted_by is null;"],
}
for name, chunks in PARTS.items():
    body = ["-- GENERATED oleh scripts/extract_seed.py. Jalankan berurutan 1 -> 4 di SQL Editor.",
            "begin;", "set local app.skip_audit = 'on';\n", *chunks, "commit;"]
    (parts_dir / f"{name}.sql").write_text("\n".join(body))
    print(f"  seed_parts/{name}.sql  {(parts_dir / f'{name}.sql').stat().st_size/1024:.0f} KB")
