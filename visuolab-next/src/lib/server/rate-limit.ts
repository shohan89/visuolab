import "server-only";

/**
 * Fixed-window counter in D1. Returns how many hits the key has had in the current window (this hit included).
 * One statement, so concurrent requests cannot both read the same count.
 */
export async function countHit(db: D1Database, key: string, windowSeconds: number): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END
       RETURNING count`,
    )
    .bind(key, now, now - windowSeconds)
    .first<{ count: number }>();
  // housekeeping: drop counters that expired long ago (about 1 request in 50)
  if (Math.random() < 0.02) await db.prepare("DELETE FROM rate_limits WHERE window_start < ?1").bind(now - 7 * 86400).run();
  return row?.count ?? 1;
}

export async function clearKey(db: D1Database, key: string): Promise<void> {
  await db.prepare("DELETE FROM rate_limits WHERE key = ?1").bind(key).run();
}

/** Limits for the contact form. */
export const CONTACT_LIMITS = {
  perVisitor: { max: 5, windowSeconds: 3600 },
  perEmail: { max: 3, windowSeconds: 86400 },
  siteWide: { max: 200, windowSeconds: 3600 },
} as const;
