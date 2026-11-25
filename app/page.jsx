"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "../lib/auth";

export default function Home() {
  const router = useRouter();
  const { profile } = useMe();
  useEffect(() => { if (profile) router.replace(profile.role === "store" ? "/input/" : "/dashboard/"); }, [profile, router]);
  return <p style={{ padding: 24 }}>Memuat…</p>;
}
