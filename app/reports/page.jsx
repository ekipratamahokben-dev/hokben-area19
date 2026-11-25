"use client";
import { useState } from "react";
import { todayJkt } from "../../lib/format";
import { useMe } from "../../lib/auth";
import { supabase } from "../../lib/supabase-browser";
import { buildExport } from "../../lib/exportXlsx";

const TYPES = [
  ["harian", "Daily sales (per store per hari, dengan total)"],
  ["mtd", "MTD sales (rekap bulan sampai tanggal akhir)"],
  ["raw", "Raw data lengkap (untuk pivot sendiri)"],
];

export default function Reports() {
  const { profile } = useMe();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const today = todayJkt();
  const [type, setType] = useState("harian");
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [group, setGroup] = useState("");
  async function download() {
    setBusy(true); setErr("");
    try {
      const { blob, filename } = await buildExport(supabase, { type, from, to, group });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr("Gagal membuat file: " + (e.message ?? e)); }
    setBusy(false);
  }
  const quick = (days) => { const d = new Date(Date.now() + 7 * 3600e3 - days * 864e5).toISOString().slice(0, 10); setFrom(d); setTo(today); };

  if (profile?.role === "store") return <div className="card">Halaman ini hanya untuk admin dan area manager.</div>;
  return (
    <>
      <h1>Export laporan ke Excel</h1>
      <p className="sub">Pilih jenis laporan dan periode, lalu unduh.</p>
      <div className="card">
        <div className="grid">
          <div><label>Jenis laporan</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label>Dari tanggal</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label>Sampai tanggal</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div><label>Tipe store</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">Semua</option><option value="mall">Mall</option><option value="stand_alone">Stand alone</option>
              <option value="shophouse">Shophouse</option><option value="hokben_kitchen">Hokben Kitchen</option>
            </select></div>
        </div>
        <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="alt" onClick={() => quick(0)}>Hari ini</button>
          <button className="alt" onClick={() => quick(6)}>7 hari terakhir</button>
          <button className="alt" onClick={() => setFrom(today.slice(0, 8) + "01")}>Awal bulan ini</button>
        </p>
        <button onClick={download} disabled={busy}>{busy ? "Menyiapkan file…" : "Unduh .xlsx"}</button>
        {err && <div className="msg err">{err}</div>}
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Laporan MTD memakai bulan dari tanggal akhir; tanggal awal diabaikan.</p>
      </div>
    </>
  );
}
