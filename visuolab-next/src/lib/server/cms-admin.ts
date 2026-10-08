import "server-only";
import { listPages, listRevisions, listSections, readSectionForEdit } from "@/lib/cms/store";
import type { PageTemplate } from "@/lib/cms/types";
import { getDb } from "./db";
import { getSiteConfig } from "./site-config";
import type { VideoOption } from "@/components/admin/SectionEditor";

/** Reads for the Pages screens of the admin (the writes are in src/actions/cms-pages.ts). */
export const adminPages = () => listPages(getDb());
export const adminSections = (template: PageTemplate) => listSections(getDb(), template);
export const adminRevisions = (template: PageTemplate, key: string) => listRevisions(getDb(), template, key);
export const adminSection = (template: PageTemplate, key: string) => readSectionForEdit(getDb(), template, key);

/** The videos in the media library, for the showreel field. */
export async function videoOptions(): Promise<VideoOption[]> {
  const r = await getDb().prepare("SELECT id, title FROM media WHERE kind = 'video' ORDER BY created_at DESC, slug LIMIT 100").all<{ id: string; title: string }>();
  return (r.results ?? []).map((v) => ({ id: String(v.id), title: String(v.title) }));
}

/** What a page uses for its title and description when its own search settings are empty: Settings → SEO → Page metadata. */
export async function seoDefaults(template: PageTemplate): Promise<{ title: string; description: string }> {
  const pages: Partial<Record<string, { title: string; description: string }>> = (await getSiteConfig()).seo.pages;
  const p = pages[template];
  return { title: p?.title ?? "", description: p?.description ?? "" };
}
