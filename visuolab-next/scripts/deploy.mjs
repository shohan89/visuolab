// Production deploy to Cloudflare Workers, with the checks that stop a bad deploy.
//   node scripts/deploy.mjs --check-only     build for production, run every check, deploy nothing        (npm run deploy:check)
//   node scripts/deploy.mjs                  the same, then deploy to the "production" environment        (npm run deploy)
//   node scripts/deploy.mjs --remote ...     also ask Cloudflare: secrets set, migrations applied (needs CLOUDFLARE_API_TOKEN)
// Nothing here prints or stores a secret. See docs/PRODUCTION-DEPLOYMENT.md.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const run = (cmd, env = {}) => execSync(cmd, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
const out = (cmd) => execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: process.env }).toString();
const problems = [];
const warn = [];
const bad = (m) => problems.push(m);

// 1. build for the production environment (selects env.production of wrangler.jsonc: SITE_URL, observability, ...)
console.log("\n== Building for production");
run("npx vite build", { CLOUDFLARE_ENV: "production" });

// 2. the resolved configuration that will be uploaded
const cfgPath = path.join(ROOT, "dist", "server", "wrangler.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const vars = cfg.vars ?? {};
console.log("\n== Checking the production configuration");
try {
  const u = new URL(String(vars.SITE_URL));
  if (u.protocol !== "https:") bad(`SITE_URL must be https (is ${vars.SITE_URL})`);
  if (/^(localhost|127\.|\[::1\])/.test(u.hostname) || /REPLACE|example\.(com|org|net)$/i.test(u.hostname)) bad(`SITE_URL is still a placeholder or a local address (${vars.SITE_URL}): set it in wrangler.jsonc env.production.vars`);
  if (u.pathname !== "/" || u.search || u.hash) bad("SITE_URL must be the bare origin, e.g. https://visuolab.com (no path)");
} catch {
  bad(`SITE_URL is not a valid address (${vars.SITE_URL})`);
}
if (vars.EDGE_CACHE !== "1") bad(`EDGE_CACHE should be "1" in production (is ${JSON.stringify(vars.EDGE_CACHE)})`);
if (!["0", "1"].includes(String(vars.IMAGE_TRANSFORMS))) bad("IMAGE_TRANSFORMS must be \"0\" or \"1\"");
if (vars.MEDIA_BASE_URL && !/^https:\/\/[^\s/]+$/.test(vars.MEDIA_BASE_URL)) bad("MEDIA_BASE_URL must be empty or a bare https origin");
for (const name of Object.keys(vars)) {
  if (["INTEGRATIONS_ALLOW_HTTP", "EMAIL_API_BASE", "TURNSTILE_VERIFY_URL"].includes(name)) bad(`${name} is a development/test switch and must not be set in production`);
  if (/KEY|SECRET|TOKEN|PASSWORD|WEBHOOK_URL/i.test(name)) bad(`${name} looks like a secret: secrets are set with "wrangler secret put", never in wrangler.jsonc`);
}
for (const [k, v] of Object.entries(vars)) if (/re_[A-Za-z0-9_]{16,}|Bearer |-----BEGIN|hooks\.slack\.com\/services/.test(String(v))) bad(`vars.${k} contains something that looks like a credential`);
if (!cfg.d1_databases?.some((d) => d.binding === "DB" && /^[0-9a-f-]{36}$/.test(d.database_id))) bad("D1 binding DB with a database_id is missing");
if (!cfg.r2_buckets?.some((b) => b.binding === "MEDIA" && b.bucket_name)) bad("R2 binding MEDIA is missing");
if (cfg.assets?.binding !== "ASSETS") bad("assets binding ASSETS is missing");
if (!cfg.observability?.enabled) bad("observability is not enabled");
for (const f of ["nodejs_compat", "global_fetch_strictly_public"]) if (!cfg.compatibility_flags?.includes(f)) bad(`compatibility flag ${f} is missing`);
if (cfg.name !== "visuolab-next") bad(`the Worker name is ${cfg.name}; secrets are set for "visuolab-next"`);
if (cfg.workers_dev === true && cfg.routes?.length) warn.push("a custom domain is configured and workers.dev is still on: switch workers_dev off once the domain works");
if (!cfg.routes?.length) warn.push("no custom domain route yet (the Worker will answer on its workers.dev address only)");

// 3. nothing from development may ship
console.log("== Checking that no development credentials ship");
for (const f of [".dev.vars", ".env", ".env.local"]) {
  const p = path.join(ROOT, "dist", "server", f);
  if (fs.existsSync(p)) { fs.rmSync(p); console.log(`   removed dist/server/${f} (a copy of the local development secrets that the build tool leaves next to the Worker)`); }
}
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const dev = fs.existsSync(path.join(ROOT, ".dev.vars")) ? fs.readFileSync(path.join(ROOT, ".dev.vars"), "utf8").split("\n").map((l) => l.split("=").slice(1).join("=").trim()).filter((v) => v.length >= 12) : [];
if (dev.length) for (const f of walk(path.join(ROOT, "dist")).filter((x) => /[.](js|json|html|css|txt|xml|map)$/.test(x))) { const t = fs.readFileSync(f, "utf8"); if (dev.some((v) => t.includes(v))) bad(`a value from .dev.vars appears in ${path.relative(ROOT, f)}`); }
const tracked = execSync("git ls-files", { cwd: path.resolve(ROOT, ".."), stdio: ["ignore", "pipe", "pipe"] }).toString().split("\n");
for (const t of tracked) if (/(^|\/)(\.env|\.dev\.vars)(\.local)?$/.test(t)) bad(`${t} is tracked by git`);
const bundle = walk(path.join(ROOT, "dist", "client")).some((f) => /\.(js|html)$/.test(f) && /SESSION_SECRET=|RESEND_API_KEY=|CLOUDFLARE_API_TOKEN/.test(fs.readFileSync(f, "utf8")));
if (bundle) bad("a secret assignment appears in the public bundle");

// 4. Cloudflare-side checks (read-only)
if (args.has("--remote")) {
  console.log("== Checking Cloudflare (read-only)");
  try {
    const secrets = JSON.parse(out("npx wrangler secret list --env production --format json").replace(/^[^[]*/, ""));
    const names = secrets.map((s) => s.name);
    for (const need of ["SESSION_SECRET"]) if (!names.includes(need)) bad(`secret ${need} is not set on the production Worker (npx wrangler secret put ${need} --env production)`);
    for (const opt of ["RESEND_API_KEY"]) if (!names.includes(opt)) warn.push(`secret ${opt} is not set: enquiries are stored but no email is sent`);
  } catch (e) { warn.push("could not list secrets (the Worker may not exist yet, which is normal before the first deploy)"); }
  try {
    const m = out("npx wrangler d1 migrations list visuolab --remote");
    if (/Migrations to be applied|\bto be applied\b/i.test(m) && !/No migrations to apply/i.test(m)) bad("the remote D1 has migrations that are not applied: npm run db:migrate:remote");
  } catch { bad("could not read the remote D1 migrations (token, account or database id wrong?)"); }
}

for (const w of warn) console.log("   note: " + w);
if (problems.length) { console.error("\nNOT READY TO DEPLOY:\n" + problems.map((p) => "  - " + p).join("\n")); process.exit(1); }
console.log("\nAll checks passed.");
if (args.has("--check-only")) { console.log("Check only: nothing was deployed."); process.exit(0); }

// 5. deploy (the build above is reused)
console.log("\n== Deploying to the production environment");
run("npx vinext-cloudflare deploy --env production --skip-build");
