"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, findUserByEmail, requireAdmin } from "@/lib/server/auth";
import { hashPassword, verifyPassword } from "@/lib/server/crypto";
import { getDb } from "@/lib/server/db";
import { clearKey, countHit } from "@/lib/server/rate-limit";
import { ipHash, requestHeaders, sameOrigin } from "@/lib/server/request";
import { STATUSES, deleteSubmission, setSubmissionStatus, type SubmissionStatus } from "@/lib/server/submissions";

const LOGIN_FAILED = "That email and password do not match.";
const LOGIN_LOCKED = "Too many attempts. Try again in a few minutes.";
const LOGIN_MAX = 5;
const LOGIN_WINDOW = 15 * 60;

// A real hash of a password nobody knows, checked when the e-mail is not a user, so a wrong e-mail takes as long as a wrong password.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword(crypto.randomUUID()));

export type LoginResult = { error: string } | undefined;

/** Email + password sign-in. Same message for a wrong email and a wrong password; five tries per 15 minutes per visitor. */
export async function login(formData: FormData): Promise<LoginResult> {
  const h = await requestHeaders();
  if (!sameOrigin(h)) return { error: LOGIN_FAILED };
  const db = getDb();
  const visitor = await ipHash(h);
  const key = `login:${visitor}`;
  const attempts = await countHit(db, key, LOGIN_WINDOW);
  if (attempts > LOGIN_MAX) return { error: LOGIN_LOCKED };

  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const user = await findUserByEmail(email);
  // always run a password check (against a dummy when there is no such user) so timing does not reveal which part failed
  const passwordOk = await verifyPassword(password, user ? user.password_hash : await getDummyHash());
  if (!user || user.status !== "active" || !passwordOk) return { error: LOGIN_FAILED };

  await clearKey(db, key);
  await createSession(user.id, visitor, h.get("user-agent") ?? "");
  redirect("/admin/submissions");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

async function guard() {
  const h = await requestHeaders();
  if (!sameOrigin(h)) throw new Error("bad origin");
  return requireAdmin();
}

export async function changeStatus(formData: FormData): Promise<void> {
  await guard();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as SubmissionStatus;
  if (!/^[0-9a-f-]{36}$/.test(id) || !STATUSES.includes(status)) return;
  await setSubmissionStatus(id, status);
  redirect(String(formData.get("back") ?? "/admin/submissions").startsWith("/admin/") ? String(formData.get("back")) : "/admin/submissions");
}

export async function removeSubmission(formData: FormData): Promise<void> {
  await guard();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await deleteSubmission(id);
  redirect(String(formData.get("back") ?? "/admin/submissions").startsWith("/admin/") ? String(formData.get("back")) : "/admin/submissions");
}
