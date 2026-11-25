"use client";
import { useState } from "react";

export default function CopyWA({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button className="alt" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}>
      {done ? "Tersalin" : "Salin format WA"}
    </button>
  );
}
