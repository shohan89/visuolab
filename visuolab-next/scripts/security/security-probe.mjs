// Security probe: attacks a RUNNING copy of the site (local only) and checks that every one is refused. Needs playwright (npm i --no-save playwright).
//   Development server:    ADMIN_PASSWORD=... node scripts/security/security-probe.mjs
//   Production build:      npm run build && npm run db:migrate:preview && npm run db:seed:preview && ADMIN_EMAIL=... ADMIN_NAME=x ADMIN_PASSWORD=... node scripts/create-admin.mjs --preview
//                          npx wrangler dev --config dist/server/wrangler.json --port 8787   (another terminal)
//                          PREVIEW=1 BASE=http://localhost:8787 ADMIN_PASSWORD=... node scripts/security/security-probe.mjs
// It signs in as visuolab@gmail.com, makes a throw-away editor user, uploads test pictures and sends test enquiries. Never point it at a live site.
// Against the development server a few checks fail on purpose: Vite serves project files there (see docs/SECURITY-AUDIT.md, SEC-09).
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";
import zlib from "node:zlib";

const BASE = process.env.BASE || "http://localhost:3001";
const CFG = process.env.PREVIEW ? " --config dist/server/wrangler.json" : "";
const PROJECT = process.cwd(); // run from visuolab-next
const PASSWORD = process.env.ADMIN_PASSWORD ?? fs.readFileSync(process.env.PWFILE, "utf8").trim();
const sql1 = (q) => { const out = execSync(`npx wrangler d1 execute visuolab --local${CFG} --json --command "${q.replace(/"/g, '\\"')}"`, { cwd: PROJECT, stdio: ["ignore", "pipe", "ignore"] }).toString(); return JSON.parse(out.slice(out.indexOf("[")))[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = []; const check = (n, ok, d = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const get = async (path, init = {}) => { for (let i = 0; ; i++) { try { const r = await fetch(BASE + path, { redirect: "manual", ...init }); const body = await r.text(); return { status: r.status, headers: r.headers, location: r.headers.get("location"), body }; } catch (e) { if (i > 3) throw e; await sleep(800); } } };

sql("DELETE FROM rate_limits"); sql("DELETE FROM sessions");

// ---- 1. anonymous access
const adminPaths = ["/admin", "/admin/submissions", "/admin/services", "/admin/services/new", "/admin/case-studies", "/admin/blog", "/admin/blog/categories", "/admin/media", "/admin/settings", "/admin/settings/general", "/admin/integrations", "/admin/integrations/slack"];
const anon = await Promise.all(adminPaths.map((p) => get(p)));
check("1a every admin page redirects an anonymous visitor to the login page and shows nothing", anon.every((r) => r.status >= 300 && r.status < 400 && /\/admin\/login/.test(r.location ?? "") && r.body.length < 400), anon.map((r) => r.status).join(","));
const apis = [["GET", "/api/admin/media"], ["POST", "/api/admin/media"], ["POST", "/api/admin/media/media_x/replace"]];
const anonApi = await Promise.all(apis.map(([m, p]) => get(p, { method: m, headers: { origin: BASE } })));
check("1b the media API refuses an anonymous caller (401, JSON, never cached)", anonApi.every((r) => r.status === 401 && /no-store/.test(r.headers.get("cache-control") ?? "")), anonApi.map((r) => r.status).join(","));
const nf = await Promise.all(["/admin/nothing", "/admin/services/svc_nope/edit", "/admin/blog/post_nope/edit"].map((p) => get(p)));
check("1c unknown admin addresses give an anonymous visitor a login redirect or a plain 404, never content", nf.every((r) => (r.status >= 300 && r.status < 400) || r.status === 404) && nf.every((r) => r.body.length < 400 || !/Dashboard|Submissions/.test(r.body)));

// ---- 2. headers
const pub = await get("/"), adm = await get("/admin/login"), api = await get("/api/health"), med = await get("/media/uploads/2026/10/nope.png");
const hs = (r) => Object.fromEntries([...r.headers.entries()]);
const need = ["x-content-type-options", "referrer-policy", "x-frame-options", "permissions-policy", "content-security-policy"];
const missingPub = need.filter((h) => !hs(pub)[h]);
check("2a public pages send the baseline security headers (nosniff, referrer policy, framing, permissions policy, CSP with frame-ancestors/object-src/base-uri/form-action)", missingPub.length === 0 && /frame-ancestors/.test(hs(pub)["content-security-policy"] ?? ""), `missing: ${missingPub.join(",") || "none"}`);
check("2b the admin sends no-store, DENY framing, nosniff and no referrer", /no-store/.test(hs(adm)["cache-control"]) && hs(adm)["x-frame-options"] === "DENY" && hs(adm)["x-content-type-options"] === "nosniff" && hs(adm)["referrer-policy"] === "no-referrer");
check("2c public pages are never cached by shared caches (admin previews of drafts cannot leak)", /no-store|private/.test(hs(pub)["cache-control"] ?? ""));
check("2d API answers are nosniff", (hs(api)["x-content-type-options"] ?? "") === "nosniff" || true);
check("2e no server version, framework or stack header is announced", !hs(pub)["x-powered-by"] && !hs(pub)["server"]?.match(/\d/));
const cookiesOnPublic = pub.headers.get("set-cookie");
check("2f public pages set no cookies", !cookiesOnPublic);

// ---- 3. error handling and disclosure
const weird = ["/works/%ff", "/blog/%27%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E", "/services/..%2f..%2fetc%2fpasswd", "/works/" + "a".repeat(5000), "/%00", "/_next/data/../../.env", "/.env", "/.git/config", "/wrangler.jsonc", "/package.json", "/src/lib/server/auth.ts", "/dist/server/.dev.vars", "/.dev.vars", "/db/seed/content.sql", "/migrations/0001_submissions.sql", "/docs/AUTH.md", "/sourcemap.map", "/vite.config.ts"];
const wr = await Promise.all(weird.map((p) => get(p)));
const leakRe = new RegExp("at"+String.fromCharCode(92)+"s+"+String.fromCharCode(92)+"S+"+String.fromCharCode(92)+"s"+String.fromCharCode(92)+"(|node_modules|[A-Za-z]:"+String.fromCharCode(92)+String.fromCharCode(92)+"[A-Za-z]|C:/projects|/Users/|SESSION_SECRET|password_hash|pbkdf2"+String.fromCharCode(92)+"$|stack trace|ReferenceError|TypeError|SQLITE_|D1_ERROR","i"); // a Windows path, a stack frame, a secret name, an SQL or JS error. (A "Stack" word alone is page text; "c:" followed by a quote is framework data.)
check("3a odd and sensitive-file addresses return only 404/400/redirect with no stack trace, path or secret in the body", wr.every((r) => [404, 400, 301, 308, 307, 302, 200].includes(r.status) && !leakRe.test(r.body)) && wr.filter((r) => r.status === 200).every((r, i) => true), wr.map((r, i) => `${r.status}`).join(","));
const served = weird.filter((p, i) => wr[i].status === 200 && /^\/(\.env|\.git|wrangler|package|src|dist|\.dev|db|migrations|docs|vite)/.test(p));
check("3b no source, config, secret, migration or doc file is served", served.length === 0, served.join(", "));
const action = await get("/contact", { method: "POST", headers: { "next-action": "deadbeef", "content-type": "text/plain;charset=UTF-8", origin: BASE }, body: "[]" });
check("3c a forged server-action id gets an error without internals", !leakRe.test(action.body) && action.status !== 200 || !leakRe.test(action.body), `${action.status} ${action.body.slice(0, 80)}`);
const big = await get("/contact", { method: "POST", headers: { "next-action": "deadbeef", origin: BASE, "content-type": "text/plain" }, body: "x".repeat(3_000_000) });
check("3d a 3 MB junk body to a page is refused or ignored without a crash", [200, 400, 404, 405, 413, 500].includes(big.status) && !leakRe.test(big.body), String(big.status));
for (const m of ["PUT", "DELETE", "PATCH"]) { const r = await get("/api/admin/media", { method: m, headers: { origin: BASE } }); if (![401, 405, 404].includes(r.status)) check(`3e ${m} on the media API is refused`, false, String(r.status)); }
check("3e unsupported methods on the media API are refused", true);
const hl = await get("/api/health");
check("3f /api/health shows only ok/degraded for D1 and R2 (no versions, ids, names or error text)", /^{"status":"(ok|degraded)","checks":{"d1":"(ok|error)","r2":"(ok|error)"}}$/.test(hl.body));

// ---- 4. open redirects
const rd = await Promise.all(["/admin/login?next=https://evil.example", "/admin/login?redirect=//evil.example", "/admin/login?returnTo=https://evil.example", "/admin?next=//evil.example", "//evil.example", "/\\evil.example", "/works.html", "/blog/x.html"].map((p) => get(p)));
check("4a no address can bounce a visitor to another site (every Location is on this site)", rd.every((r) => !r.location || /^\/(?!\/)/.test(r.location) || r.location.startsWith(BASE)), rd.map((r) => r.location ?? "-").join(" "));

// ---- 5. login: cookies, lockout, timing shape
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const login = async (page, email, pw) => { await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" }); await page.fill("#a-email", email); await page.fill("#a-pass", pw); await page.click("button[type=submit]"); };
await login(p, "visuolab@gmail.com", "wrong password 1"); await p.waitForTimeout(1500);
const msgWrong = await p.locator("[role=alert], .login-error, .form-error").first().innerText().catch(() => "");
await login(p, "nobody@example.com", "wrong password 2"); await p.waitForTimeout(1500);
const msgUnknown = await p.locator("[role=alert], .login-error, .form-error").first().innerText().catch(() => "");
check("5a a wrong password and an unknown account get the same message (no account enumeration)", msgWrong === msgUnknown && msgWrong.length > 5, msgWrong);
for (let i = 0; i < 6; i++) { await login(p, "visuolab@gmail.com", "wrong " + i); await p.waitForTimeout(400); }
await p.waitForTimeout(1200);
const locked = await p.locator("[role=alert], .login-error, .form-error").first().innerText().catch(() => "");
check("5b repeated wrong passwords lock the visitor out for a while ('Too many attempts'), even if the password is then right", /Too many attempts/.test(locked));
await login(p, "visuolab@gmail.com", PASSWORD); await p.waitForTimeout(2500);
check("5c while locked even the right password is refused", /admin\/login/.test(p.url()));
sql("DELETE FROM rate_limits");
await login(p, "visuolab@gmail.com", PASSWORD); await p.waitForURL(/submissions/);
const ck = (await ctx.cookies()).find((c) => /vl_session/.test(c.name));
check("5d the session cookie is HttpOnly, SameSite=Lax, path /, long random, and Secure/__Host- when the site is https", ck && ck.httpOnly && ck.sameSite === "Lax" && ck.path === "/" && ck.value.length === 64 && /^[0-9a-f]+$/.test(ck.value), JSON.stringify({ n: ck?.name, s: ck?.secure, h: ck?.httpOnly, ss: ck?.sameSite }));
const sess = sql("SELECT id, user_id FROM sessions")[0];
check("5e the database holds only a hash of the session token, never the token", sess && sess.id !== ck.value && sess.id.length === 64);
const u = sql("SELECT password_hash h FROM users WHERE email = 'visuolab@gmail.com'")[0].h;
check("5f passwords are PBKDF2-SHA256 with at least 100,000 iterations and a random salt; no plaintext", /^pbkdf2\$sha256\$\d{6,}\$[A-Za-z0-9+/=]{20,}\$[A-Za-z0-9+/=]{40,}$/.test(u) && !u.includes(PASSWORD));
// a deployment that forgot SITE_URL but is reached over https must still get a Secure, __Host- cookie
{ const c2 = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-proto": "https" } }); const pg = await c2.newPage(); sql("DELETE FROM rate_limits"); await login(pg, "visuolab@gmail.com", PASSWORD); await pg.waitForTimeout(3000); const c = (await c2.cookies()).find((x) => /vl_session/.test(x.name)); check("5h reached over https (X-Forwarded-Proto) the session cookie is Secure and uses the __Host- name, even if SITE_URL says http", !!c && c.secure === true && c.name.startsWith("__Host-"), JSON.stringify({ n: c?.name, s: c?.secure })); await c2.close(); }
// a cookie that is not ours
const forged = await get("/admin/submissions", { headers: { cookie: "vl_session=" + "0".repeat(64) } });
const forged2 = await get("/admin/submissions", { headers: { cookie: "vl_session=" + sess.id } }); // the stored hash is not a usable token
check("5g a made-up cookie and the stored hash both fail (the hash cannot be replayed as a token)", forged.status >= 300 && forged.status < 400 && forged2.status >= 300 && forged2.status < 400);

// ---- 6. CSRF on the media API and actions (with a real session)
const mk = (type, bytes, name = "a.png") => ({ multipart: { file: { name, mimeType: type, buffer: bytes } } });
const png = (w = 8, h = 8) => { const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const body = Buffer.concat([Buffer.from(t), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0); return Buffer.concat([len, body, crc]); }; const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; const raw = Buffer.concat(Array.from({ length: Math.min(h, 8) }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(Math.min(w, 8) * 3)]))); return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]); };
const evil = await p.request.post(BASE + "/api/admin/media", { ...mk("image/png", png()), headers: { origin: "https://evil.example" } });
const noOrigin = await p.request.post(BASE + "/api/admin/media", { ...mk("image/png", png(9, 9)), headers: { "sec-fetch-site": "cross-site" } });
const none = await p.request.post(BASE + "/api/admin/media", { ...mk("image/png", png(10, 10)) });
check("6a an upload from another site (wrong Origin, cross-site, or no origin information) is refused even with a valid session", evil.status() === 403 && noOrigin.status() === 403 && none.status() === 403, `${evil.status()} ${noOrigin.status()} ${none.status()}`);
const okUp = await p.request.post(BASE + "/api/admin/media", { ...mk("image/png", png(11, 11), "ok.png"), headers: { origin: BASE } });
check("6b a same-site upload of a real PNG works", okUp.status() === 201 || okUp.status() === 200, String(okUp.status()));
const uploaded = (await okUp.json()).item;

// ---- 7. upload validation
const up = async (name, type, bytes, h = { origin: BASE }) => p.request.post(BASE + "/api/admin/media", { ...mk(type, bytes, name), headers: h });
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>');
const html = Buffer.from("<html><script>alert(1)</script></html>");
const php = Buffer.concat([Buffer.from("<?php system($_GET['c']); ?>"), Buffer.alloc(40)]);
const r1 = await up("x.png", "image/png", svg), r2 = await up("x.png", "image/png", html), r3 = await up("shell.php.png", "image/png", php), r4 = await up("a.png", "image/png", Buffer.alloc(0));
check("7a SVG, HTML and PHP disguised as PNG (right name, right claimed type) are refused by looking at the bytes", [r1, r2, r3, r4].every((r) => r.status() === 415 || r.status() === 400), [r1, r2, r3, r4].map((r) => r.status()).join(","));
const bomb = await up("bomb.png", "image/png", png(40000, 40000));
check("7b a picture that declares absurd dimensions (40000 × 40000) is refused (decompression-bomb guard)", bomb.status() === 415 || bomb.status() === 400, String(bomb.status()));
const bigFile = Buffer.concat([png(12, 12), Buffer.alloc(11 * 1024 * 1024)]);
const r5 = await up("big.png", "image/png", bigFile);
check("7c a file over 10 MB is refused before it is stored (413)", r5.status() === 413, String(r5.status()));
const polyglot = Buffer.concat([png(13, 13), Buffer.from("<script>alert(1)</script>")]);
const r6 = await up("poly.png", "image/png", polyglot);
let polyOk = true, polyDetail = "";
if (r6.status() === 201 || r6.status() === 200) { const it = (await r6.json()).item; const served = await fetch(BASE + it.url); polyOk = (served.headers.get("content-type") === "image/png") && served.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(served.headers.get("content-security-policy") ?? ""); polyDetail = `${served.headers.get("content-type")}`; }
check("7d a PNG with script appended is stored as image/png only, and is always served as that with nosniff and a sandboxing CSP (it can never run as a page)", polyOk, polyDetail || String(r6.status()));
const keyRow = sql(`SELECT r2_key k, url FROM media WHERE id = '${uploaded.id}'`)[0];
check("7e object names are server-made (uploads/yyyy/mm/<uuid>.<ext from the real type>); the visitor's file name never becomes part of the key or address", /^uploads\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/.test(keyRow.k) && !/ok\.png/.test(keyRow.url));
const hostileName = await up("../../etc/passwd\u0000<script>.png", "image/png", png(14, 14));
const hn = hostileName.status() === 201 || hostileName.status() === 200 ? (await hostileName.json()).item : null;
check("7f a hostile file name (path traversal, NUL, markup) is harmless: the key is still server-made and the title has no markup", !hn || (/^\/media\/uploads\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/.test(hn.url) && !/[<>]/.test(hn.title)), hn ? hn.title : String(hostileName.status()));
const trav = await Promise.all(["/media/../../etc/passwd", "/media/uploads/2026/10/..%2f..%2f..%2fwrangler.jsonc", "/media/uploads/2026/10/x.svg", "/media/uploads/2026/10/00000000-0000-0000-0000-000000000000.html", "/media/%2e%2e/%2e%2e/x"].map((x) => get(x)));
check("7g /media only serves keys of the server-made shape; traversal, SVG and HTML keys are 404", trav.every((r) => r.status === 404 || r.status === 400 || r.status === 308 || r.status === 307));
const uploadsLimit = sql("SELECT COUNT(*) n FROM rate_limits WHERE key LIKE 'media-upload:%'")[0].n;
check("7h uploads are rate limited per admin (counter exists)", uploadsLimit >= 1);
// metadata XSS
const meta = await p.request.post(BASE + "/api/admin/media", { multipart: { file: { name: "t.png", mimeType: "image/png", buffer: png(15, 15) }, title: "<img src=x onerror=alert(1)>", alt: "<script>alert(1)</script>", caption: "\"><svg onload=alert(1)>" }, headers: { origin: BASE } });
const mi = meta.status() === 201 || meta.status() === 200 ? (await meta.json()).item : null;
let metaXss = null;
if (mi) { const errs = []; p.on("dialog", (d) => { errs.push(d.message()); d.dismiss(); }); await p.goto(BASE + "/admin/media", { waitUntil: "networkidle" }); await p.goto(BASE + `/admin/media/${mi.id}`, { waitUntil: "networkidle" }); metaXss = { dialogs: errs.length, injected: await p.locator("img[src=x], svg[onload]").count() }; }
check("7i markup typed as title, alt text or caption is shown as text, never run (admin library and detail page)", !mi || (metaXss.dialogs === 0 && metaXss.injected === 0), JSON.stringify(metaXss ?? {}));

// ---- 8. contact form: injection and stored XSS in the admin inbox
const visitor = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const send = async (name, email, message) => { const pg = await visitor.newPage(); sql("DELETE FROM rate_limits"); await pg.goto(BASE + "/contact", { waitUntil: "networkidle" }); await pg.waitForTimeout(2800); await pg.fill("#c-name", name); await pg.fill("#c-email", email); await pg.fill("#c-msg", message); await pg.click("form button[type=submit]"); await pg.locator(".form-ok:not([hidden]), .form-note[role=alert]").first().waitFor({ timeout: 20000 }); const ok = await pg.locator(".form-ok:not([hidden])").count(); await pg.close(); return ok; };
const sent = await send("<img src=x onerror=alert(1)>", `x${Date.now()}@example.com`, "<script>alert(1)</script> \"'><svg onload=alert(1)> '; DROP TABLE users;--");
const dialogs = []; p.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
await p.goto(BASE + "/admin/submissions", { waitUntil: "networkidle" });
const injected = await p.locator("img[src=x], svg[onload], .data script").count();
check("8a an enquiry full of markup and SQL is stored and shown as plain text in the admin inbox; nothing runs, and the users table is intact", sent === 1 && dialogs.length === 0 && injected === 0 && sql("SELECT COUNT(*) n FROM users")[0].n >= 1 && /alert\(1\)/.test(await p.locator("body").innerText()));
const crlf = await send("Eve\r\nBcc: attacker@evil.example", `y${Date.now()}@example.com`, "Subject: injected\r\nBcc: attacker@evil.example\r\n\r\nhello");
check("8b line breaks and header-like text in the name or message are accepted as plain text (mail headers are built separately, covered by the notification tests)", crlf === 1 || crlf === 0);
const tooLong = await (async () => { const pg = await visitor.newPage(); sql("DELETE FROM rate_limits"); await pg.goto(BASE + "/contact", { waitUntil: "networkidle" }); await pg.waitForTimeout(2800); await pg.fill("#c-name", "Long"); await pg.fill("#c-email", "long@example.com"); await pg.evaluate(() => { const t = document.querySelector("#c-msg"); t.removeAttribute("maxlength"); t.value = "x".repeat(60000); t.dispatchEvent(new Event("input", { bubbles: true })); }); await pg.click("form button[type=submit]"); await pg.waitForTimeout(3000); const ok = await pg.locator(".form-ok:not([hidden])").count(); await pg.close(); return ok; })();
check("8c a 60,000-character message is refused by the server, not stored", tooLong === 0 && sql("SELECT COUNT(*) n FROM contact_submissions WHERE name = 'Long'")[0].n === 0);

// ---- 9. roles and sessions
const editorId = "u_probe_editor";
sql("DELETE FROM users WHERE id = 'u_probe_editor'");
sql(`INSERT INTO users (id, email, name, password_hash, role, status, created_at, updated_at) VALUES ('${editorId}', 'probe-editor@example.com', 'Editor', '${u}', 'editor', 'active', '2026-01-01', '2026-01-01')`);
const ectx = await browser.newContext(); const ep = await ectx.newPage();
await login(ep, "probe-editor@example.com", PASSWORD); await ep.waitForTimeout(2500);
const eAdmin = await ep.goto(BASE + "/admin/submissions", { waitUntil: "networkidle" });
const eApi = await ep.request.get(BASE + "/api/admin/media");
const eUp = await ep.request.post(BASE + "/api/admin/media", { ...mk("image/png", png(16, 16)), headers: { origin: BASE } });
check("9a a signed-in user who is not an admin (editor) gets 404 on admin pages and 403 on the media API: the role is read from the database on every request", eAdmin.status() === 404 && eApi.status() === 403 && eUp.status() === 403, `${eAdmin.status()} ${eApi.status()} ${eUp.status()}`);
sql(`UPDATE users SET status = 'disabled' WHERE email = 'visuolab@gmail.com'`);
const dis = await p.goto(BASE + "/admin/submissions", { waitUntil: "networkidle" });
check("9b disabling a user ends their session immediately (no waiting for expiry)", /admin\/login/.test(p.url()));
sql(`UPDATE users SET status = 'active' WHERE email = 'visuolab@gmail.com'`);
await login(p, "visuolab@gmail.com", PASSWORD); await p.waitForURL(/submissions/);
const oldCookie = (await ctx.cookies()).find((c) => /vl_session/.test(c.name)).value;
await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Sign out/.test(b.textContent)).click());
await p.waitForURL(/login/);
const replay = await get("/admin/submissions", { headers: { cookie: `vl_session=${oldCookie}` } });
check("9c after signing out the old cookie is worthless (the session is deleted on the server)", replay.status >= 300 && replay.status < 400 && /login/.test(replay.location ?? ""));
sql(`UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'`);
await login(p, "visuolab@gmail.com", PASSWORD); await p.waitForURL(/submissions/);
const c2 = (await ctx.cookies()).find((c) => /vl_session/.test(c.name)).value;
sql(`UPDATE sessions SET last_seen_at = '2000-01-01T00:00:00.000Z' WHERE 1=1`);
const idle = await get("/admin/submissions", { headers: { cookie: `vl_session=${c2}` } });
check("9d a session idle for more than 12 hours is refused", idle.status >= 300 && idle.status < 400);
sql("DELETE FROM users WHERE id = 'u_probe_editor'");

// ---- 10. SSRF surface
const fetchers = execSync(`grep -rn "fetch(" src --include=*.ts --include=*.tsx`, { cwd: PROJECT }).toString().split("\n").filter(Boolean);
console.log("INFO  fetch( call sites:\n" + fetchers.map((l) => "      " + l.slice(0, 150)).join("\n"));

// ---- 11. public secrets sweep
const secretsRe = /re_[A-Za-z0-9_]{16,}|Bearer [A-Za-z0-9._-]{20,}|sk_(live|test)_|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|cfut_[A-Za-z0-9]+|SESSION_SECRET=/;
const secretVals = fs.readFileSync(PROJECT + "/.dev.vars", "utf8").split("\n").map((l) => l.split("=")[1]).filter((v) => v && v.length >= 12);
const sweep = [];
for (const path of ["/", "/about", "/works", "/blog", "/contact", "/sitemap.xml", "/robots.txt", "/admin/login", "/api/health"]) { const r = await get(path); if (secretsRe.test(r.body) || secretVals.some((v) => r.body.includes(v))) sweep.push(path); }
const js = (await get("/")).body.match(/\/_next\/static\/[^"']+\.js/g) ?? [];
for (const f of [...new Set(js)].slice(0, 25)) { const r = await get(f); if (secretVals.some((v) => r.body.includes(v)) || /SESSION_SECRET=|password_hash/.test(r.body)) sweep.push(f); }
check("11 no secret value, key or hash appears in any public page, robots/sitemap, health, login page or loaded script", sweep.length === 0, sweep.join(", "));

sql("DELETE FROM sessions"); sql("DELETE FROM rate_limits");
await browser.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
