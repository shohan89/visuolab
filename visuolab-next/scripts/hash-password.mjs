// Usage: node scripts/hash-password.mjs   (reads password from prompt-less env var)
//   ADMIN_PASSWORD='...' node scripts/hash-password.mjs
// Prints a scrypt hash for the ADMIN_PASSWORD_HASH secret. Never commit the password.
import { scryptSync, randomBytes } from "node:crypto";
const pw = process.env.ADMIN_PASSWORD;
if (!pw) { console.error("Set ADMIN_PASSWORD env var."); process.exit(1); }
const salt = randomBytes(16);
const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
console.log(`scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`);
