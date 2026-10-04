import "server-only";
import { getDb } from "./db";

/** Appends one row to audit_logs. Never throws: a logging problem must not block sign-in or an admin action. */
export async function audit(entry: {
  action: string;
  userId?: string | null;
  userEmail?: string | null;
  entityType?: string;
  entityId?: string;
  summary?: string;
  ipHash?: string;
}): Promise<void> {
  try {
    await getDb()
      .prepare(
        `INSERT INTO audit_logs (id, user_id, user_email, action, entity_type, entity_id, summary, ip_hash, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(
        crypto.randomUUID(),
        entry.userId ?? null,
        entry.userEmail ?? null,
        entry.action,
        entry.entityType ?? "auth",
        entry.entityId ?? null,
        entry.summary ?? entry.action,
        entry.ipHash ?? null,
        new Date().toISOString(),
      )
      .run();
  } catch (e) {
    console.error("audit log failed", e instanceof Error ? e.message : e);
  }
}
