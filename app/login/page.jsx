"use client";
import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";

export default function Login() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    const email = id.includes("@") ? id.trim() : `${id.trim().toLowerCase()}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN}`;
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password: pw });
    if (error) setErr("Kode store atau password salah. Periksa lagi, atau hubungi admin area.");
    
  }

  return (
    <div className="login">
      <section className="panel">
        <h2>Laporan sales harian, dari store ke area dalam satu tempat.</h2>
        <p>Isi update sementara siang hari, kirim laporan final malam hari. Angka area terhitung otomatis.</p>
      </section>
      <section className="form">
        <form onSubmit={submit}>
          <h1>Masuk</h1>
          <p className="sub">Gunakan kode store, misalnya A01.</p>
          <label htmlFor="id">Kode store atau email</label>
          <input id="id" value={id} onChange={(e) => setId(e.target.value)} autoFocus autoCapitalize="none" required />
          <label htmlFor="pw" style={{ marginTop: 12 }}>Password</label>
          <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          {err && <div className="msg err">{err}</div>}
          <button>Masuk</button>
        </form>
      </section>
    </div>
  );
}
