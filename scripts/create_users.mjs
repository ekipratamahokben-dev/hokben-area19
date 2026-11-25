// Membuat akun login: 1 akun per store + 1 admin (+ opsional 1 area manager).
// Profil (role, store) dibuat otomatis oleh trigger handle_new_user di database.
//
// Pakai:  cp .env.example .env   (isi nilainya)   lalu   npm run create-users
// Hasil:  credentials.csv (email + password awal). File ini di-.gitignore: bagikan lewat kanal aman,
//         lalu minta tiap pengguna mengganti password setelah login pertama.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL_DOMAIN, ADMIN_EMAIL, AREA_MANAGER_EMAIL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EMAIL_DOMAIN || !ADMIN_EMAIL) {
  console.error("Isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL_DOMAIN, ADMIN_EMAIL di .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { stores } = JSON.parse(readFileSync(new URL("../data/seed_data.json", import.meta.url)));
const newPassword = () => randomBytes(9).toString("base64url"); // 12 karakter

const accounts = [
  { email: ADMIN_EMAIL, role: "admin", full_name: "Admin Area 19" },
  ...(AREA_MANAGER_EMAIL ? [{ email: AREA_MANAGER_EMAIL, role: "area_manager", full_name: "Area Manager 19" }] : []),
  ...stores.map((s) => ({
    email: `${s.code.toLowerCase()}@${EMAIL_DOMAIN}`,
    role: "store",
    store_code: s.code,
    full_name: s.pic_name ? `${s.pic_name} (${s.short_name})` : s.short_name,
  })),
];

const rows = ["email,password,role,store_code"];
for (const a of accounts) {
  const password = newPassword();
  const { error } = await supabase.auth.admin.createUser({
    email: a.email,
    password,
    email_confirm: true,
    user_metadata: { role: a.role, store_code: a.store_code ?? null, full_name: a.full_name },
  });
  if (error) {
    console.log(`SKIP  ${a.email}: ${error.message}`);
    continue;
  }
  rows.push([a.email, password, a.role, a.store_code ?? ""].join(","));
  console.log(`OK    ${a.email} (${a.role}${a.store_code ? " " + a.store_code : ""})`);
}

writeFileSync("credentials.csv", rows.join("\n") + "\n");
console.log(`\n${rows.length - 1} akun baru ditulis ke credentials.csv`);
