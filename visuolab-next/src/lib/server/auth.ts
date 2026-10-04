import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomToken, sha256Hex } from "./crypto";
import { getDb, getEnv } from "./db";

const IDLE_MS = 12 * 3600 * 1000; // signed out after 12 hours without activity
const ABSOLUTE_MS = 14 * 24 * 3600 * 1000; // and never later than 14 days after signing in

const secureCookies = () => (getEnv().SITE_URL ?? "").startsWith("https://");
/** The __Host- prefix makes browsers refuse the cookie unless it is Secure, host-only and site-wide; it needs HTTPS, so local dev uses a plain name. */
const cookieName = () => (secureCookies() ? "__Host-vl_session" : "vl_session");

export type AdminUser = { id: string; email: string; name: string; role: "admin" | "editor" };

type UserRow = { id: string; email: string; name: string; password_hash: string; role: "admin" | "editor"; status: "active" | "disabled" };

/** Looks a user up by e-mail (case-insensitive). Disabled users are returned too; the caller decides. */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  return getDb().prepare("SELECT id, email, name, password_hash, role, status FROM users WHERE email = ?1").bind(email).first<UserRow>();
}

export async function createSession(userId: string, ipHash: string, userAgent: string): Promise<void> {
  const token = randomToken(32);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  await getDb().batch([
    getDb()
      .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, ip_hash, user_agent) VALUES (?1, ?2, ?3, ?4, ?3, ?5, ?6)")
      .bind(await sha256Hex(token), userId, iso, new Date(now + ABSOLUTE_MS).toISOString(), ipHash, userAgent.slice(0, 200)),
    getDb().prepare("UPDATE users SET last_login_at = ?2 WHERE id = ?1").bind(userId, iso),
    getDb().prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(iso), // housekeeping
  ]);
  (await cookies()).set(cookieName(), token, { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: ABSOLUTE_MS / 1000 });
}

/** The signed-in admin, or null. Reads the session cookie, checks both limits and the user, and refreshes the idle timer. */
export async function getAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const id = await sha256Hex(token);
  const row = await getDb()
    .prepare(
      `SELECT s.expires_at, s.last_seen_at, u.id AS user_id, u.email, u.name, u.role, u.status
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?1`,
    )
    .bind(id)
    .first<{ expires_at: string; last_seen_at: string; user_id: string; email: string; name: string; role: "admin" | "editor"; status: string }>();
  if (!row) return null;
  const now = Date.now();
  if (row.status !== "active" || Date.parse(row.expires_at) < now || Date.parse(row.last_seen_at) + IDLE_MS < now) {
    await getDb().prepare("DELETE FROM sessions WHERE id = ?1").bind(id).run();
    return null;
  }
  if (now - Date.parse(row.last_seen_at) > 5 * 60 * 1000) {
    await getDb().prepare("UPDATE sessions SET last_seen_at = ?2 WHERE id = ?1").bind(id, new Date(now).toISOString()).run();
  }
  return { id: row.user_id, email: row.email, name: row.name, role: row.role };
}

/** Use at the top of every admin page, action and handler. Sends visitors who are not signed in to the login page. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (token && /^[0-9a-f]{64}$/.test(token)) await getDb().prepare("DELETE FROM sessions WHERE id = ?1").bind(await sha256Hex(token)).run();
  jar.set(cookieName(), "", { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: 0 });
}
