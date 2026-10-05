import "server-only";
import { getDb } from "./db";
import { listSubmissions, type Submission } from "./submissions";

export type ContentUpdate = { kind: "Service" | "Case study" | "Blog post" | "Media" | "Setting"; title: string; status: string; updatedAt: string };

export type DashboardData = {
  services: number;
  publishedCases: number;
  publishedPosts: number;
  unread: number;
  recentSubmissions: Submission[];
  recentUpdates: ContentUpdate[];
};

/** Everything the overview page shows, in one round of queries. Call only after requireAdmin(). */
export async function getDashboard(): Promise<DashboardData> {
  const db = getDb();
  const [counts, recent, updates] = await Promise.all([
    db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM services) AS services,
           (SELECT COUNT(*) FROM case_studies WHERE status = 'published') AS cases,
           (SELECT COUNT(*) FROM blog_posts WHERE status = 'published') AS posts,
           (SELECT COUNT(*) FROM contact_submissions WHERE status = 'new') AS unread`,
      )
      .first<{ services: number; cases: number; posts: number; unread: number }>(),
    listSubmissions({ limit: 5 }),
    db
      .prepare(
        `SELECT kind, title, status, updated_at FROM (
           SELECT 'Service' AS kind, title, status, updated_at FROM services
           UNION ALL SELECT 'Case study', title, status, updated_at FROM case_studies
           UNION ALL SELECT 'Blog post', title, status, updated_at FROM blog_posts
           UNION ALL SELECT 'Setting', title, status, updated_at FROM site_settings
           UNION ALL SELECT 'Media', title, status, updated_at FROM media
         ) ORDER BY updated_at DESC, title LIMIT 8`,
      )
      .all<{ kind: ContentUpdate["kind"]; title: string; status: string; updated_at: string }>(),
  ]);
  return {
    services: counts?.services ?? 0,
    publishedCases: counts?.cases ?? 0,
    publishedPosts: counts?.posts ?? 0,
    unread: counts?.unread ?? 0,
    recentSubmissions: recent.items,
    recentUpdates: (updates.results ?? []).map((r) => ({ kind: r.kind, title: r.title.replace(/<[^>]*>/g, ""), status: r.status, updatedAt: r.updated_at })),
  };
}
