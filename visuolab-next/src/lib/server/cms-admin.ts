import "server-only";
import { listPages, listRevisions, listSections, readSectionForEdit } from "@/lib/cms/store";
import type { PageTemplate } from "@/lib/cms/types";
import { getDb } from "./db";
import { getSiteUrl } from "@/lib/site";
import { getSiteConfig } from "./site-config";

/** Reads for the Pages screens of the admin (the writes are in src/actions/cms-pages.ts). */
export const adminPages = () => listPages(getDb());
export const adminSections = (template: PageTemplate) => listSections(getDb(), template);
export const adminRevisions = (template: PageTemplate, key: string) => listRevisions(getDb(), template, key);
export const adminSection = (template: PageTemplate, key: string) => readSectionForEdit(getDb(), template, key);

/** What a page uses for its title and description when its own search settings are empty: Settings → SEO → Page metadata. */
export async function seoDefaults(template: PageTemplate): Promise<{ title: string; description: string }> {
  const pages: Partial<Record<string, { title: string; description: string }>> = (await getSiteConfig()).seo.pages;
  const p = pages[template];
  return { title: p?.title ?? "", description: p?.description ?? "" };
}

/** What the SEO editor shows around the fields: the site's name and address (for the search result preview) and whether indexing is on for the site. */
export async function seoSite(): Promise<{ name: string; url: string; indexing: boolean }> {
  const [cfg, url] = await Promise.all([getSiteConfig(), getSiteUrl()]);
  return { name: cfg.general.siteName, url: url.replace(/\/+$/, ""), indexing: cfg.seo.indexing };
}
