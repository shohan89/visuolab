// Creates (or resets the password of) an admin user in D1.
//
//   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='a long password' node scripts/create-admin.mjs [--remote] [--preview]
//
//   (default)   the local database used by `npm run dev`
//   --preview   the local database used by `npm run preview`
//   --remote    the live database. Check `npx wrangler whoami` first.
//
// The password is hashed here (PBKDF2-SHA256, 100,000 iterations, random salt, same format as src/lib/server/crypto.ts); only the
// hash is written to the database. Do not commit the password and do not paste it into chats or tickets.
import { execFileSync } from "node:child_process";
import { randomUUID, webcrypto as crypto } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const name = (process.env.ADMIN_NAME ?? "Admin").trim();
const password = process.env.ADMIN_PASSWORD ?? "";
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error("Set ADMIN_EMAIL to a valid address."); process.exit(1); }
if (password.length < 12) { console.error("Set ADMIN_PASSWORD (at least 12 characters)."); process.exit(1); }

const iterations = 100_000; // the Workers runtime refuses more than 100,000
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
const b64 = (buf) => Buffer.from(buf).toString("base64");
const hash = `pbkdf2$sha256$${iterations}$${b64(salt)}$${b64(bits)}`;

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const now = new Date().toISOString();
const sql = `INSERT INTO users (id, email, name, password_hash, role, status, created_at, updated_at)
VALUES (${q(randomUUID())}, ${q(email)}, ${q(name)}, ${q(hash)}, 'admin', 'active', ${q(now)}, ${q(now)})
ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, role = 'admin', status = 'active', updated_at = excluded.updated_at;
DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ${q(email)});`; // a changed password signs the user out everywhere

// the package does not export its bin file, so find it next to the project (run the script from visuolab-next)
const wrangler = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
const args = ["d1", "execute", "visuolab"];
if (process.argv.includes("--remote")) args.push("--remote");
else { args.push("--local"); if (process.argv.includes("--preview")) args.push("--config", "dist/server/wrangler.json"); }

const dir = mkdtempSync(join(tmpdir(), "vl-admin-"));
const file = join(dir, "admin.sql");
try {
  writeFileSync(file, sql);
  execFileSync(process.execPath, [wrangler, ...args, "--file", file], { stdio: "inherit" });
  console.log(`Admin user ${email} is ready.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
