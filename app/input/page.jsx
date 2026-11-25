"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";
import { CHANNELS, rp, todayJkt } from "../../lib/format";

const SDM = [["tms", "TMS"], ["cl_tmbs", "CL + TMBS"], ["honorer", "Honorer"], ["part_time", "Part time"]];
const n = (v) => Number(v || 0);

export default function InputPage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [me, setMe] = useState(null);
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [date, setDate] = useState(todayJkt());
  const [tab, setTab] = useState("final"); // "interim" | "final"
  const [f, setF] = useState({});
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      const { data: profile } = await sb.from("profiles").select("role, store_id").eq("id", user.id).single();
      const { data: list } = await sb.from("stores").select("id, code, short_name").eq("is_active", true).order("code");
      setMe({ user, profile });
      setStores(list ?? []);
      setStoreId(profile.store_id ?? list?.[0]?.id ?? "");
    })();
  }, [sb]);

  // isi ulang form dengan data yang sudah tersimpan untuk store + tanggal + tab ini
  useEffect(() => {
    if (!storeId) return;
    (async () => {
      setMsg(null);
      const q = tab === "final"
        ? sb.from("daily_reports").select("*").eq("store_id", storeId).eq("report_date", date).maybeSingle()
        : sb.from("interim_updates").select("*").eq("store_id", storeId).eq("report_date", date)
            .order("submitted_at", { ascending: false }).limit(1).maybeSingle();
      const { data } = await q;
      const next = {};
      if (data) Object.entries(data).forEach(([k, v]) => { next[k] = typeof v === "number" || /^-?\d/.test(String(v)) ? String(k === "lost" ? Math.abs(v) : v) : v; });
      setF(next);
    })();
  }, [sb, storeId, date, tab]);

  const total = CHANNELS.reduce((s, [k]) => s + n(f[k]), 0);
  const totalTc = CHANNELS.reduce((s, [k]) => s + n(f["tc_" + k]), 0);
  const readOnly = me?.profile?.role === "area_manager";

  async function save() {
    setMsg(null);
    if (tab === "final") {
      if (total > 0 && totalTc === 0) return setMsg({ err: "Total sales terisi tetapi TC masih 0. Isi TC per layanan." });
      // peringatan angka tidak wajar: > N x rata-rata 14 hari terakhir
      const { data: hist } = await sb.from("daily_reports").select("total_sales").eq("store_id", storeId)
        .lt("report_date", date).order("report_date", { ascending: false }).limit(14);
      const { data: st } = await sb.from("settings").select("value").eq("key", "anomaly_multiplier").single();
      const avg = hist?.length ? hist.reduce((s, r) => s + Number(r.total_sales), 0) / hist.length : 0;
      if (avg > 0 && total > avg * (st?.value ?? 3) &&
          !confirm(`Total ${rp(total)} lebih dari ${st.value}x rata-rata 14 hari (${rp(avg)}). Tetap simpan?`)) return;
    }
    const base = { store_id: storeId, report_date: date, submitted_by: me.user.id };
    CHANNELS.forEach(([k]) => (base[k] = n(f[k])));
    let error;
    if (tab === "final") {
      CHANNELS.forEach(([k]) => (base["tc_" + k] = Math.round(n(f["tc_" + k]))));
      SDM.forEach(([k]) => (base[k] = Math.round(n(f[k]))));
      Object.assign(base, { waste: Math.abs(n(f.waste)), lost: -Math.abs(n(f.lost)),
        cfb_di: Math.round(n(f.cfb_di)), cfb_ta: Math.round(n(f.cfb_ta)), notes: f.notes || null });
      ({ error } = await sb.from("daily_reports").upsert(base, { onConflict: "store_id,report_date" }));
    } else {
      base.cutoff_time = new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16);
      ({ error } = await sb.from("interim_updates").insert(base));
    }
    setMsg(error ? { err: error.message.includes("row-level security")
      ? "Tidak bisa disimpan: tanggal di luar jendela edit, periode terkunci, atau bukan store Anda." : error.message }
      : { ok: tab === "final" ? "Laporan final tersimpan." : `Update sementara jam ${base.cutoff_time} tersimpan.` });
  }

  if (!me) return <p>Memuat…</p>;
  const Field = ({ k, label }) => (
    <div><label>{label}</label>
      <input type="number" inputMode="numeric" min="0" value={f[k] ?? ""} onChange={set(k)} disabled={readOnly} /></div>
  );

  return (
    <>
      <h1>Input laporan harian</h1>
      <p className="sub">Update sementara untuk siang hari, laporan final untuk malam hari.</p>
      <div className="card grid">
        {me.profile.role !== "store" && (
          <div><label>Store</label>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.short_name}</option>)}
            </select></div>
        )}
        <div><label>Tanggal</label>
          <input type="date" value={date} max={todayJkt()} onChange={(e) => setDate(e.target.value)} /></div>
      </div>

      <div className="tabs">
        <button className={tab === "interim" ? "on" : ""} onClick={() => setTab("interim")}>Update sementara</button>
        <button className={tab === "final" ? "on" : ""} onClick={() => setTab("final")}>Laporan final</button>
      </div>

      <div className="card">
        <h2>Sales per layanan (Rp)</h2>
        <div className="grid">{CHANNELS.map(([k, l]) => <Field key={k} k={k} label={l} />)}</div>
        <p><strong>Total sales: Rp {rp(total)}</strong></p>
      </div>

      {tab === "final" && (
        <>
          <div className="card">
            <h2>Transaction count (TC) per layanan</h2>
            <div className="grid">{CHANNELS.map(([k, l]) => <Field key={k} k={"tc_" + k} label={l} />)}</div>
            <p><strong>Total TC: {rp(totalTc)}</strong></p>
          </div>
          <div className="card">
            <h2>Crew hari ini</h2>
            <div className="grid">{SDM.map(([k, l]) => <Field key={k} k={k} label={l} />)}</div>
            <h2 style={{ marginTop: 14 }}>Waste, lost, CFB</h2>
            <div className="grid">
              <Field k="waste" label="Waste (Rp)" /><Field k="lost" label="Lost (Rp, tulis positif)" />
              <Field k="cfb_di" label="CFB dine in" /><Field k="cfb_ta" label="CFB take away" />
            </div>
            <label style={{ marginTop: 10 }}>Catatan (hujan, event mall, promo, kendala)</label>
            <textarea rows="2" value={f.notes ?? ""} onChange={set("notes")} disabled={readOnly} />
          </div>
        </>
      )}

      {msg?.err && <div className="msg err">{msg.err}</div>}
      {msg?.ok && <div className="msg ok">{msg.ok}</div>}
      {!readOnly && (
        <div className="savebar">
          <span><small>{tab === "final" ? "Total sales dan TC" : "Total sales"}</small>Rp {rp(total)}{tab === "final" ? ` dan ${rp(totalTc)} TC` : ""}</span>
          <button onClick={save}>{tab === "final" ? "Simpan laporan final" : "Kirim update sementara"}</button>
        </div>
      )}
    </>
  );
}
