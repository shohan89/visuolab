// Prints the PBKDF2-SHA256 hash to store as the ADMIN_PASSWORD_HASH secret. Same format and cost as src/lib/server/crypto.ts.
//
//   ADMIN_PASSWORD='your password' node scripts/hash-password.mjs
//
// Then:  npx wrangler secret put ADMIN_PASSWORD_HASH   (production)   or put it in .dev.vars (local).
// The password itself is never stored anywhere. Do not commit it, and do not paste it into chats or tickets.
import { webcrypto as crypto } from "node:crypto";

const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) {
  console.error("Set ADMIN_PASSWORD (at least 12 characters) in the environment for this one command.");
  process.exit(1);
}
const iterations = 600_000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
const b64 = (buf) => Buffer.from(buf).toString("base64");
console.log(`pbkdf2$sha256$${iterations}$${b64(salt)}$${b64(bits)}`);
