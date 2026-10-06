import "server-only";
import type { NotifyStatus, Outcome } from "@/lib/integrations/email/delivery";
import { getDb } from "./db";

export const STATUSES = ["new", "read", "replied", "archived", "spam"] as const;
export type SubmissionStatus = (typeof STATUSES)[number];

export type Submission = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  service: string | null;
  budget: string | null;
  message: string;
  status: SubmissionStatus;
  source: string;
  ipHash: string | null;
  userAgent: string | null;
  /** When the mail provider accepted the notification (null: not sent). */
  notifiedAt: string | null;
  /** Why the notification failed or was skipped. */
  notifyError: string | null;
  notifyStatus: NotifyStatus;
  notifyProvider: string | null;
  notifyMessageId: string | null;
  notifyAttempts: number;
  notifyLastAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string; name: string; email: string; company: string | null; service: string | null; budget: string | null; message: string;
  status: SubmissionStatus; source: string; ip_hash: string | null; user_agent: string | null; notified_at: string | null;
  notify_error: string | null; notify_status: NotifyStatus; notify_provider: string | null; notify_message_id: string | null;
  notify_attempts: number; notify_last_attempt_at: string | null; created_at: string; updated_at: string;
};

const toSubmission = (r: Row): Submission => ({
  id: r.id, name: r.name, email: r.email, company: r.company, service: r.service, budget: r.budget, message: r.message, status: r.status,
  source: r.source, ipHash: r.ip_hash, userAgent: r.user_agent, notifiedAt: r.notified_at, notifyError: r.notify_error, notifyStatus: r.notify_status,
  notifyProvider: r.notify_provider, notifyMessageId: r.notify_message_id, notifyAttempts: r.notify_attempts, notifyLastAttemptAt: r.notify_last_attempt_at,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export type NewSubmission = {
  name: string; email: string; company?: string; service?: string; budget?: string; message: string;
  status: SubmissionStatus; source: string; ipHash: string; userAgent: string;
  /** Random key from the form: the same key is stored once. */
  idempotencyKey?: string;
  /** Fingerprint of e-mail and message. */
  contentHash: string;
};

/** How long the same text from the same address counts as the same enquiry sent again. */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

/** An enquiry already stored for this key, or the same text from the same address a few minutes ago. Returns its id, or null. */
export async function findDuplicate(key: string | undefined, contentHash: string): Promise<{ id: string; why: "key" | "content" } | null> {
  const db = getDb();
  if (key) {
    const byKey = await db.prepare("SELECT id FROM contact_submissions WHERE idempotency_key = ?1").bind(key).first<{ id: string }>();
    if (byKey) return { id: byKey.id, why: "key" };
  }
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const byContent = await db.prepare("SELECT id FROM contact_submissions WHERE content_hash = ?1 AND created_at > ?2 LIMIT 1").bind(contentHash, since).first<{ id: string }>();
  return byContent ? { id: byContent.id, why: "content" } : null;
}

/**
 * Stores the enquiry. Returns its id, or `null` when another request with the same idempotency key got there first (two clicks at
 * once): the unique index decides, so only one row can exist whatever the timing.
 */
export async function insertSubmission(s: NewSubmission): Promise<string | null> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await getDb()
      .prepare(
        `INSERT INTO contact_submissions (id, name, email, company, service, budget, message, status, source, ip_hash, user_agent, idempotency_key, content_hash, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14)`,
      )
      .bind(id, s.name, s.email, s.company ?? null, s.service ?? null, s.budget ?? null, s.message, s.status, s.source, s.ipHash, s.userAgent.slice(0, 200), s.idempotencyKey ?? null, s.contentHash, now)
      .run();
    return id;
  } catch (e) {
    if (s.idempotencyKey && /UNIQUE/i.test(e instanceof Error ? `${e.message} ${(e as { cause?: Error }).cause?.message ?? ""}` : "")) return null;
    throw e;
  }
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const r = await getDb().prepare("SELECT * FROM contact_submissions WHERE id = ?1").bind(id).first<Row>();
  return r ? toSubmission(r) : null;
}

/* ---- delivery records ----------------------------------------------------------------------------------------- */

/** Written BEFORE sending, so an attempt that is cut short (the Worker stops mid-request) still shows as tried. */
export async function recordAttemptStart(id: string): Promise<void> {
  await getDb().prepare("UPDATE contact_submissions SET notify_attempts = notify_attempts + 1, notify_last_attempt_at = ?2 WHERE id = ?1").bind(id, new Date().toISOString()).run();
}

/** Writes what happened. Never touches the enquiry itself (its text, its status, who sent it). */
export async function recordOutcome(id: string, o: Outcome): Promise<void> {
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `UPDATE contact_submissions SET notify_status = ?2, notify_provider = ?3, notify_message_id = ?4, notify_error = ?5,
         notified_at = CASE WHEN ?2 = 'sent' THEN ?6 ELSE NULL END, notify_last_attempt_at = COALESCE(notify_last_attempt_at, ?6)
       WHERE id = ?1`,
    )
    .bind(id, o.status, o.provider, o.messageId, o.error, now)
    .run();
}

/* ---- listing -------------------------------------------------------------------------------------------------- */

export type NotifyFilter = "all" | "problems";

export async function listSubmissions(opts: { status?: SubmissionStatus | "all"; notify?: NotifyFilter; limit?: number; offset?: number }): Promise<{ items: Submission[]; total: number }> {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const conds: string[] = [];
  const binds: unknown[] = [];
  if (opts.status && opts.status !== "all") { binds.push(opts.status); conds.push(`status = ?${binds.length}`); }
  // problems: a real enquiry whose notification failed, or was never tried (spam is expected to have none)
  if (opts.notify === "problems") conds.push("status <> 'spam' AND notify_status IN ('failed', 'pending')");
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = await db.prepare(`SELECT * FROM contact_submissions ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`).bind(...binds).all<Row>();
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM contact_submissions ${where}`).bind(...binds).first<{ n: number }>();
  return { items: (rows.results ?? []).map(toSubmission), total: count?.n ?? 0 };
}

export async function countsByStatus(): Promise<Record<SubmissionStatus | "all", number>> {
  const rows = await getDb().prepare("SELECT status, COUNT(*) AS n FROM contact_submissions GROUP BY status").all<{ status: SubmissionStatus; n: number }>();
  const out: Record<string, number> = { all: 0, new: 0, read: 0, replied: 0, archived: 0, spam: 0 };
  for (const r of rows.results ?? []) { out[r.status] = r.n; out.all = (out.all ?? 0) + r.n; }
  return out as Record<SubmissionStatus | "all", number>;
}

/** Real enquiries whose notification failed or never went out. Shown in the admin so nobody is missed. */
export async function countNotifyProblems(): Promise<number> {
  const r = await getDb().prepare("SELECT COUNT(*) AS n FROM contact_submissions WHERE status <> 'spam' AND notify_status IN ('failed', 'pending')").first<{ n: number }>();
  return r?.n ?? 0;
}

export async function setSubmissionStatus(id: string, status: SubmissionStatus): Promise<void> {
  await getDb().prepare("UPDATE contact_submissions SET status = ?2, updated_at = ?3 WHERE id = ?1").bind(id, status, new Date().toISOString()).run();
}

export async function deleteSubmission(id: string): Promise<void> {
  await getDb().prepare("DELETE FROM contact_submissions WHERE id = ?1").bind(id).run();
}
