"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, findUserByEmail, getAdmin, requireAdmin } from "@/lib/server/auth";
import { hashPassword, verifyPassword } from "@/lib/server/crypto";
import { getDb } from "@/lib/server/db";
import { clearKey, countHit } from "@/lib/server/rate-limit";
import { audit } from "@/lib/server/audit";
import { ipHash, requestHeaders, strictSameOrigin, valueHash } from "@/lib/server/request";
import { STATUSES, deleteSubmission, setSubmissionStatus, type SubmissionStatus } from "@/lib/server/submissions";

const LOGIN_FAILED = "That email and password do not match.";
const LOGIN_LOCKED = "Too many attempts. Try again in a few minutes.";
const LOGIN_MAX = 5; // per visitor
const LOGIN_MAX_PER_EMAIL = 10; // per account, across all visitors (slows a distributed guess without making lock-out trivial)
const LOGIN_WINDOW = 15 * 60;

// A real hash of a password nobody knows, checked when the e-mail is not a user, so a wrong e-mail takes as long as a wrong password.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword(crypto.randomUUID()));

export type LoginResult = { error: string } | undefined;

/** Email + password sign-in. Same message for a wrong email and a wrong password; five tries per 15 minutes per visitor. */
export async function login(formData: FormData): Promise<LoginResult> {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) return { error: LOGIN_FAILED };
  const db = getDb();
  const visitor = await ipHash(h);
  const key = `login:${visitor}`;
  const attempts = await countHit(db, key, LOGIN_WINDOW);
  if (attempts > LOGIN_MAX) {
    await audit({ action: "login.locked", summary: "Sign-in refused: too many attempts from this visitor", ipHash: visitor });
    return { error: LOGIN_LOCKED };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const emailKey = `login:email:${await valueHash("login-email", email)}`;
  if ((await countHit(db, emailKey, LOGIN_WINDOW)) > LOGIN_MAX_PER_EMAIL) {
    await audit({ action: "login.locked", summary: "Sign-in refused: too many attempts for one account", ipHash: visitor });
    return { error: LOGIN_LOCKED };
  }
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const user = await findUserByEmail(email);
  // always run a password check (against a dummy when there is no such user) so timing does not reveal which part failed
  const passwordOk = await verifyPassword(password, user ? user.password_hash : await getDummyHash());
  if (!user || user.status !== "active" || !passwordOk) {
    await audit({ action: "login.failed", userId: user?.id ?? null, userEmail: user?.email ?? null, summary: "Failed sign-in", ipHash: visitor });
    return { error: LOGIN_FAILED };
  }

  await clearKey(db, key);
  await clearKey(db, emailKey);
  await createSession(user.id, visitor, h.get("user-agent") ?? "");
  await audit({ action: "login.success", userId: user.id, userEmail: user.email, entityId: user.id, summary: "Signed in", ipHash: visitor });
  redirect("/admin/submissions");
}

export async function logout(): Promise<void> {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  const admin = await getAdmin();
  await destroySession();
  if (admin) await audit({ action: "logout", userId: admin.id, userEmail: admin.email, entityId: admin.id, summary: "Signed out", ipHash: await ipHash(h) });
  redirect("/admin/login");
}

async function guard() {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  return requireAdmin();
}

/** Where to go after an action: the page the form came from (only inside /admin), with a notice code the toast system shows. */
function backTo(formData: FormData, notice: "status" | "deleted"): string {
  const back = String(formData.get("back") ?? "");
  const base = back.startsWith("/admin/") || back === "/admin" ? back : "/admin/submissions";
  return `${base}${base.includes("?") ? "&" : "?"}n=${notice}`;
}

export async function changeStatus(formData: FormData): Promise<void> {
  const admin = await guard();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as SubmissionStatus;
  if (!/^[0-9a-f-]{36}$/.test(id) || !STATUSES.includes(status)) return;
  await setSubmissionStatus(id, status);
  await audit({ action: "submission.status", userId: admin.id, userEmail: admin.email, entityType: "contact_submission", entityId: id, summary: `Status set to ${status}` });
  redirect(backTo(formData, "status"));
}

export async function removeSubmission(formData: FormData): Promise<void> {
  const admin = await guard();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await deleteSubmission(id);
  await audit({ action: "submission.delete", userId: admin.id, userEmail: admin.email, entityType: "contact_submission", entityId: id, summary: "Submission deleted" });
  redirect(backTo(formData, "deleted"));
}
