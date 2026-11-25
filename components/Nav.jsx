"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";

const I = {
  input: "M4 20h4l10-10-4-4L4 16v4zM14 6l4 4",
  dashboard: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  reports: "M12 3v12m0 0l-4-4m4 4l4-4M4 20h16",
};
const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export default function Nav({ role, name }) {
  const path = usePathname();
  const router = useRouter();
  const items = [["/input/", "Input", "input"], ["/dashboard/", "Dashboard", "dashboard"],
    ...(role !== "store" ? [["/reports/", "Laporan", "reports"]] : [])];
  const label = { admin: "Admin", area_manager: "Area manager", store: "Store" }[role];
  const logout = async () => { await supabase.auth.signOut(); router.replace("/login/"); };
  return (
    <aside className="side">
      <div className="brand"><i>H</i><div>Daily Report<small>Area 19</small></div></div>
      <nav className="menu">
        {items.map(([href, text, ic]) => (
          <Link key={href} href={href} className={path.startsWith(href.slice(0, -1)) ? "on" : ""}><Icon d={I[ic]} />{text}</Link>
        ))}
      </nav>
      <div className="who">
        <b>{name || label}</b>{label}
        <button onClick={logout}>Keluar</button>
      </div>
    </aside>
  );
}
