"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "./supabase-browser";

const Ctx = createContext({ loading: true, user: null, profile: null });
export const useMe = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState({ loading: true, user: null, profile: null });

  useEffect(() => {
    let alive = true;
    async function load(session) {
      if (!session) return alive && setState({ loading: false, user: null, profile: null });
      const { data: profile } = await supabase.from("profiles").select("role, store_id, full_name").eq("id", session.user.id).single();
      if (alive) setState({ loading: false, user: session.user, profile });
    }
    supabase.auth.getSession().then(({ data }) => load(data.session));
    // setTimeout: jangan memanggil query Supabase langsung di dalam callback ini (bisa macet)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setTimeout(() => load(session), 0));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  // penjaga halaman: belum login -> /login, sudah login di /login -> beranda
  useEffect(() => {
    if (state.loading) return;
    const onLogin = path.startsWith("/login");
    if (!state.user && !onLogin) router.replace("/login/");
    if (state.user && state.profile && onLogin) router.replace("/");
  }, [state, path, router]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
