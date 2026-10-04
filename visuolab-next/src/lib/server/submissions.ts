import "server-only";
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
  notifiedAt: string | null;
  notifyError: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string; name: string; email: string; company: string | null; service: string | null; budget: string | null; message: string;
  status: SubmissionStatus; source: string; ip_hash: string | null; user_agent: string | null; notified_at: string | null;
  notify_error: string | null; created_at: string; updated_at: string;
};

const toSubmission = (r: Row): Submission => ({
  id: r.id, name: r.name, email: r.email, company: r.company, service: r.service, budget: r.budget, message: r.message, status: r.status,
  source: r.source, ipHash: r.ip_hash, userAgent: r.user_agent, notifiedAt: r.notified_at, notifyError: r.notify_error,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export type NewSubmission = {
  name: string; email: string; company?: string; service?: string; budget?: string; message: string;
  status: SubmissionStatus; source: string; ipHash: string; userAgent: string;
};

export async function insertSubmission(s: NewSubmission): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `INSERT INTO contact_submissions (id, name, email, company, service, budget, message, status, source, ip_hash, user_agent, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)`,
    )
    .bind(id, s.name, s.email, s.company ?? null, s.service ?? null, s.budget ?? null, s.message, s.status, s.source, s.ipHash, s.userAgent.slice(0, 200), now)
    .run();
  return id;
}

export async function markNotified(id: string, error: string | null): Promise<void> {
  await getDb()
    .prepare("UPDATE contact_submissions SET notified_at = ?2, notify_error = ?3 WHERE id = ?1")
    .bind(id, error ? null : new Date().toISOString(), error ? error.slice(0, 300) : null)
    .run();
}

export async function listSubmissions(opts: { status?: SubmissionStatus | "all"; limit?: number; offset?: number }): Promise<{ items: Submission[]; total: number }> {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = opts.status && opts.status !== "all" ? "WHERE status = ?1" : "";
  const binds = opts.status && opts.status !== "all" ? [opts.status] : [];
  const rows = await db
    .prepare(`SELECT * FROM contact_submissions ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`)
    .bind(...binds)
    .all<Row>();
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM contact_submissions ${where}`).bind(...binds).first<{ n: number }>();
  return { items: (rows.results ?? []).map(toSubmission), total: count?.n ?? 0 };
}

export async function countsByStatus(): Promise<Record<SubmissionStatus | "all", number>> {
  const rows = await getDb().prepare("SELECT status, COUNT(*) AS n FROM contact_submissions GROUP BY status").all<{ status: SubmissionStatus; n: number }>();
  const out: Record<string, number> = { all: 0, new: 0, read: 0, replied: 0, archived: 0, spam: 0 };
  for (const r of rows.results ?? []) { out[r.status] = r.n; out.all = (out.all ?? 0) + r.n; }
  return out as Record<SubmissionStatus | "all", number>;
}

export async function setSubmissionStatus(id: string, status: SubmissionStatus): Promise<void> {
  await getDb().prepare("UPDATE contact_submissions SET status = ?2, updated_at = ?3 WHERE id = ?1").bind(id, status, new Date().toISOString()).run();
}

export async function deleteSubmission(id: string): Promise<void> {
  await getDb().prepare("DELETE FROM contact_submissions WHERE id = ?1").bind(id).run();
}
