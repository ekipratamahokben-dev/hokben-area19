import { createClient } from "@supabase/supabase-js";

// Satu klien untuk seluruh aplikasi. Anon key memang boleh terlihat di browser:
// data dilindungi login + aturan RLS di database, bukan oleh kerahasiaan key ini.
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
export const supabaseBrowser = () => supabase;
