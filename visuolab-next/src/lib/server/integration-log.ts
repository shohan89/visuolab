import "server-only";
import { catalogEntry } from "@/lib/integrations/core";
import { getDb } from "./db";

/** The activity log of the integrations. Kept apart from integrations.ts so the notification service can write to it without a cycle. */
const now = () => new Date().toISOString();

const RETENTION_DAYS = 30;

/**
 * Records one run: a row in the activity log and, on the integration, when it last worked or why it last failed. A success clears the
 * earlier failure (so the state goes back to Connected). Never throws: logging must not break what it logs.
 */
export async function recordRun(slug: string, event: string, r: { ok: boolean; status?: number | null; error?: string | null; ms?: number | null }, ref?: string | null): Promise<void> {
  try {
    const db = getDb();
    const t = now();
    const error = r.ok ? null : (r.error ?? "failed").slice(0, 200);
    await db.prepare("INSERT INTO integration_events (id, integration, event, status, http_status, error, duration_ms, ref, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
      .bind(`ev_${crypto.randomUUID()}`, slug, event.slice(0, 60), r.ok ? "ok" : "failed", r.status ?? null, error, r.ms ?? null, ref ?? null, t).run();
    const def = catalogEntry(slug);
    await db
      .prepare(
        `INSERT INTO integrations (id, slug, title, status, config_json, created_at, updated_at, last_checked_at, last_success_at, last_error) VALUES (?1, ?2, ?3, 'disabled', '{}', ?4, ?4, ?4, ?5, ?6)
         ON CONFLICT (slug) DO UPDATE SET last_checked_at = excluded.last_checked_at, last_error = excluded.last_error, last_success_at = COALESCE(excluded.last_success_at, integrations.last_success_at)`,
      )
      .bind(`int_${slug}`, slug, def?.label ?? slug, t, r.ok ? t : null, error)
      .run();
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
    await db.prepare("DELETE FROM integration_events WHERE created_at < ?1").bind(cutoff).run();
  } catch (e) {
    console.error("integration log failed:", e instanceof Error ? e.name : "unknown error");
  }
}

