import "server-only";
import { getDb } from "./db";

/** Actions that cannot change what a public page shows. Every other admin action bumps the content version (see src/worker.ts). */
const NO_PUBLIC_EFFECT = /^(login|logout|submission|integration.test|settings.test)|\.draft(\.|$)/;

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
    // the public pages are cached by content version: a change by an admin makes the next visit render fresh
    if (!NO_PUBLIC_EFFECT.test(entry.action)) {
      await getDb()
        .prepare(
          `INSERT INTO app_meta (key, value) VALUES ('content_version', '1')
           ON CONFLICT (key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = datetime('now')`,
        )
        .run();
    }
  } catch (e) {
    console.error("audit log failed", e instanceof Error ? e.message : e);
  }
}
