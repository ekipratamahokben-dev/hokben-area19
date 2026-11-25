"use client";
import { useEffect, useState } from "react";
import { supabase as sb } from "../../lib/supabase-browser";
import { rp, pct, num2 } from "../../lib/format";
import CopyWA from "./CopyWA";

export default function Dashboard() {
  const [pick, setPick] = useState("");          // tanggal akhir pilihan pengguna; kosong = tanggal data terakhir
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      // default: sampai tanggal terakhir yang ada datanya (bukan hari ini), seperti laporan Excel "s.d. 22 November"
      let through = pick;
      if (!through) {
        const { data: last } = await sb.from("v_daily_sales").select("report_date").order("report_date", { ascending: false }).limit(1);
        through = last?.[0]?.report_date;
      }
      if (!through) return alive && setState({ empty: true });
      const month = through.slice(0, 7) + "-01";
      const [{ data: stores }, { data: area }, { data: day }, { data: tgt }] = await Promise.all([
        sb.rpc("kpi_mtd", { p_month: month, p_through: through }),
        sb.rpc("kpi_area_mtd", { p_month: month, p_through: through }),
        sb.from("v_daily_sales").select("store_id, total_sales, is_provisional").eq("report_date", through),
        sb.from("daily_targets").select("store_id, target_sales").eq("target_date", through),
      ]);
      if (alive) setState({ through, stores, area, day, tgt });
    })();
    return () => { alive = false; };
  }, [pick]);

  if (state.loading) return <p>Memuat…</p>;
  if (state.empty) return <div className="card">Belum ada data laporan.</div>;
  const { through, stores, area, day, tgt } = state;
  const a = area?.[0];
  if (!a) return <div className="card">Tidak ada data untuk periode ini.</div>;

  // teks rekap untuk grup WhatsApp (format perkiraan; sesuaikan dengan kebiasaan grup)
  const dayBy = Object.fromEntries((day ?? []).map((d) => [d.store_id, d]));
  const tgtBy = Object.fromEntries((tgt ?? []).map((t) => [t.store_id, t.target_sales]));
  const d = new Date(through + "T00:00:00");
  const lines = (stores ?? []).map((s) => {
    const x = dayBy[s.store_id];
    return x ? `${s.short_name}: ${rp(x.total_sales)} (${pct(x.total_sales / tgtBy[s.store_id], 0)})${x.is_provisional ? " sementara" : ""}` : `${s.short_name}: belum lapor`;
  });
  const wa = `SALES AREA 19 ${d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}\n${lines.join("\n")}\n\nMTD ${rp(a.actual_mtd)} / target ${rp(a.target_mtd)} (${pct(a.pct_achievement)})`;

  const long = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const elapsedShare = a.days_elapsed / a.days_in_month;       // posisi "seharusnya" menurut kalender
  const ranked = [...(stores ?? [])].sort((x, y) => (y.pct_achievement ?? 0) - (x.pct_achievement ?? 0));
  const Stat = ({ label, value, cls }) => <div className="stat"><span>{label}</span><b className={cls}>{value}</b></div>;

  return (
    <>
      <div className="head">
        <div>
          <h1>Penjualan Area 19</h1>
          <p className="sub">Sampai {long(through)}, sisa {a.days_left} hari</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" aria-label="Sampai tanggal" value={through} style={{ width: "auto" }}
            onChange={(e) => e.target.value && setPick(e.target.value)} />
          <CopyWA text={wa} />
        </div>
      </div>

      <section className="hero">
        <div>
          <div className="lbl">Actual MTD</div>
          <div className="big">Rp {rp(a.actual_mtd)}</div>
          <div className="pace" role="img" aria-label={`Tercapai ${pct(a.pct_countdown)} dari target bulan`}>
            <i style={{ width: Math.min(a.pct_countdown, 1) * 100 + "%" }} />
            <b style={{ left: elapsedShare * 100 + "%" }} />
          </div>
          <div className="pacetxt">
            <span>{pct(a.pct_countdown)} dari target bulan Rp {rp(a.target_month)}</span>
            <span>Garis merah muda: posisi hari ini ({pct(elapsedShare, 0)} bulan)</span>
          </div>
        </div>
        <div className="side2">
          <div><span className={"pill " + (a.status === "AMAN" ? "aman" : "tidak")}>{a.status === "AMAN" ? "Aman" : "Tidak aman"}</span></div>
          <div><div className="lbl">Estimasi akhir bulan</div><b>Rp {rp(a.est_eom)}</b><span className="lbl">{pct(a.pct_est_eom)} dari target</span></div>
          <div><div className="lbl">Perlu per hari untuk 100%</div><b>Rp {rp(a.required_per_day)}</b></div>
        </div>
      </section>

      <div className="stats">
        <Stat label="Pencapaian vs target MTD" value={pct(a.pct_achievement)} cls={a.pct_achievement >= 1 ? "aman" : "tidak"} />
        <Stat label="Target MTD" value={"Rp " + rp(a.target_mtd)} />
        <Stat label="Growth vs tahun lalu" value={pct(a.growth_pct)} cls={a.growth_pct >= 0 ? "aman" : "tidak"} />
        <Stat label="TCMH" value={num2(a.tcmh)} />
      </div>

      <div className="card">
        <h2>Pencapaian per store</h2>
        <div className="rank">
          {ranked.map((s) => (
            <div className="rrow" key={s.store_id}>
              <span className="nm">{s.short_name}{s.provisional_days > 0 ? " *" : ""}</span>
              <div className="bar" role="img" aria-label={`${s.short_name} ${pct(s.pct_achievement)}`}>
                <i className={s.pct_achievement >= 1 ? "ok" : "bad"} style={{ width: Math.min(s.pct_achievement ?? 0, 1.5) / 1.5 * 100 + "%" }} />
                <b style={{ left: (1 / 1.5) * 100 + "%" }} />
              </div>
              <span className={"v " + (s.pct_achievement >= 1 ? "aman" : "tidak")}>{pct(s.pct_achievement, 0)}</span>
            </div>
          ))}
        </div>
        <p className="legend">Garis hitam menandai 100% target MTD. Hijau sudah tercapai, merah belum.{" "}
          {ranked.some((s) => s.provisional_days > 0) && "* termasuk hari yang masih memakai update sementara."}</p>
      </div>

      <div className="card">
        <h2>Rincian per store</h2>
        <div className="scroll">
          <table>
            <thead><tr>
              <th>Store</th><th>Target MTD</th><th>Actual</th><th>%</th><th>Countdown</th><th>Est. akhir bulan</th>
              <th>% est.</th><th>Perlu/hari</th><th>Growth</th><th>TCMH</th><th>Status</th>
            </tr></thead>
            <tbody>
              {(stores ?? []).map((s) => (
                <tr key={s.store_id}>
                  <td>{s.short_name}</td>
                  <td>{rp(s.target_mtd)}</td><td>{rp(s.actual_mtd)}</td>
                  <td className={s.pct_achievement >= 1 ? "aman" : "tidak"}>{pct(s.pct_achievement)}</td>
                  <td>{pct(s.pct_countdown)}</td><td>{rp(s.est_eom)}</td><td>{pct(s.pct_est_eom, 0)}</td>
                  <td>{rp(s.required_per_day)}</td><td>{pct(s.growth_pct)}</td><td>{num2(s.tcmh)}</td>
                  <td><span className={"pill " + (s.status === "AMAN" ? "aman" : "tidak")}>{s.status === "AMAN" ? "Aman" : "Tidak aman"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
