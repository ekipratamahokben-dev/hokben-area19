"use client";
import { useMe } from "../lib/auth";
import Nav from "./Nav";

export default function Shell({ children }) {
  const { loading, user, profile } = useMe();
  if (loading) return <p style={{ padding: 24 }}>Memuat…</p>;
  if (!user || !profile) return <main>{children}</main>;   // halaman login
  return (
    <div className="shell">
      <Nav role={profile.role} name={profile.full_name} />
      <main className="page">{children}</main>
    </div>
  );
}
