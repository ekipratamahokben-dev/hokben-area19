// Reset password satu akun (mis. store lupa password).  Pakai:  npm run reset-password -- a01
// Mencetak password baru di layar. Bagikan lewat kanal aman.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL_DOMAIN } = process.env;
const who = process.argv[2];
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EMAIL_DOMAIN || !who) {
  console.error("Pakai: npm run reset-password -- <kode store atau email>   (contoh: a01)");
  process.exit(1);
}
const email = who.includes("@") ? who : `${who.toLowerCase()}@${EMAIL_DOMAIN}`;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (error) { console.error(error.message); process.exit(1); }
const user = data.users.find((u) => u.email === email);
if (!user) { console.error(`Akun ${email} tidak ditemukan`); process.exit(1); }

const password = randomBytes(9).toString("base64url");
const { error: e2 } = await sb.auth.admin.updateUserById(user.id, { password });
if (e2) { console.error(e2.message); process.exit(1); }
console.log(`Password baru untuk ${email}: ${password}`);
