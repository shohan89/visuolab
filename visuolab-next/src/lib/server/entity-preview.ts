import "server-only";
import type { BlogPost, CaseStudy, ServiceSeed } from "@/content/types";
import { inputToColumns as blogColumns } from "@/lib/content/blog-mapper";
import { inputToColumns as caseColumns, inputToImages, mapCaseStudy } from "@/lib/content/case-study-mapper";
import { mapBlogPost } from "@/lib/content/blog-mapper";
import type { BlogInput } from "@/lib/validation/blog";
import type { CaseStudyInput } from "@/lib/validation/case-study";
import type { ServiceInput } from "@/lib/validation/service";
import { getBlogPosts, mapServiceRow, mediaUrls } from "./cms";
import { getDb } from "./db";
import { workingRecord } from "./entity-sections";

/*
 * Preview of a service, case study or article WITH its draft changes, for a signed-in admin (see preview.ts). The record is read as an editor sees it
 * (published record + drafts), turned back into the database row the public mapper expects, and handed to the very same mapper the public page
 * uses (`mapCaseStudy`, `mapServiceRow`, `mapBlogPost`), so the preview is drawn by the same components from the same kind of data. Nothing is written.
 */

type Row = Record<string, unknown>;
const all = async (sql: string, ...binds: unknown[]): Promise<Row[]> => (await getDb().prepare(sql).bind(...binds).all<Row>()).results ?? [];

export async function getCaseStudyPreview(slug: string): Promise<CaseStudy | null> {
  const rows = await all("SELECT * FROM case_studies ORDER BY position, slug");
  const c = rows.find((r) => r.slug === slug);
  if (!c) return null;
  const working = await workingRecord("case_study", String(c.id));
  if (!working) return null;
  const i = working.input as unknown as CaseStudyInput;
  const row: Row = {
    ...c, title: i.title, client_name: i.clientName, year: i.year, type_line: i.typeLine, short_kind: i.shortKind,
    card_image_id: i.cardImage, card_image_alt: i.cardImageAlt, cover_image_id: i.coverImage, cover_image_alt: i.coverImageAlt,
    meta_title: i.metaTitle, meta_description: i.metaDescription, about_label: i.aboutLabel, about_lead: i.description, ...caseColumns(i),
  };
  const images = inputToImages(i).map((im): Row => ({ case_study_id: c.id, media_id: im.media, role: im.role, position: im.index, caption: im.caption, alt_text: im.alt, object_position: im.position }));
  const published = Object.fromEntries(rows.filter((r) => r.status === "published").map((r) => [String(r.slug), r]));
  return mapCaseStudy(row, images, await mediaUrls(getDb()), published);
}

export async function getServicePreview(slug: string): Promise<ServiceSeed | null> {
  const v = (await all("SELECT * FROM services WHERE slug = ?1", slug))[0];
  if (!v) return null;
  const working = await workingRecord("service", String(v.id));
  if (!working) return null;
  const i = working.input as unknown as ServiceInput;
  const dims = async (id: string) => (await getDb().prepare("SELECT width, height FROM media WHERE id = ?1").bind(id).first<{ width: number | null; height: number | null }>()) ?? { width: null, height: null };
  const shot = async (id: string, alt: string, n: number) => { const d = await dims(id); return { alt, ...(d.width && d.height ? { width: d.width, height: d.height } : {}), priority: n === 0, lazy: n !== 0 }; };
  const row: Row = {
    ...v, title: i.title, meta_title: i.metaTitle, meta_description: i.metaDescription, hero_title: i.heroTitle, hero_lead: i.heroLead,
    hero_cta_label: i.heroCtaLabel, hero_cta_href: i.heroCtaHref, hero_image_a_id: i.heroImageA, hero_image_b_id: i.heroImageB,
    hero_shots_json: JSON.stringify([await shot(i.heroImageA, i.heroImageAAlt, 0), await shot(i.heroImageB, i.heroImageBAlt, 1)]),
    show_problems: i.showProblems ? 1 : 0, problems_json: JSON.stringify(i.problems), overview_json: JSON.stringify(i.overview), outcomes_json: JSON.stringify(i.outcomes),
    show_band: i.showBand ? 1 : 0, band_json: JSON.stringify({ text: i.band.text, cta: { label: i.band.ctaLabel, href: i.band.ctaHref } }),
    included_json: JSON.stringify(i.included), process_json: JSON.stringify(i.process), cases_json: JSON.stringify({ label: i.casesLabel, title: i.casesTitle }),
  };
  const cards = i.caseIds.length ? await all(`SELECT id, slug, card_image_id, card_image_alt, card_tags_json, showcase_json FROM case_studies WHERE status = 'published' AND id IN (${i.caseIds.map((_, n) => `?${n + 1}`).join(",")})`, ...i.caseIds) : [];
  const links = i.caseIds.flatMap((id) => { const c = cards.find((x) => x.id === id); return c ? [{ ...c, service_id: v.id }] : []; });
  return mapServiceRow(row, links, await mediaUrls(getDb()));
}

export async function getBlogPreview(slug: string): Promise<{ post: BlogPost; related: BlogPost[] } | null> {
  const p = (await all("SELECT * FROM blog_posts WHERE slug = ?1", slug))[0];
  if (!p) return null;
  const working = await workingRecord("blog_post", String(p.id));
  if (!working) return null;
  const i = working.input as unknown as BlogInput;
  const cat = await getDb().prepare("SELECT title FROM blog_categories WHERE id = ?1").bind(i.categoryId).first<{ title: string }>();
  const cols = blogColumns(i);
  const row: Row = {
    ...p, title: i.title, category_id: i.categoryId, category_title: cat?.title ?? "", meta_title: i.metaTitle, meta_description: i.metaDescription,
    canonical_url: i.canonicalUrl || null, og_image_id: i.ogImage || null, excerpt: i.excerpt || null, featured: i.featured ? 1 : 0, lead: i.lead,
    author_name: i.authorName, author_image_id: i.authorImage || null, cover_image_id: i.coverImage, cover_alt: i.coverAlt, ...cols,
    published_at: cols.published_at ?? p.published_at,
  };
  const post = mapBlogPost(row, await mediaUrls(getDb()), i.tags);
  const live = await getBlogPosts(getDb(), { publishedOnly: true });
  return { post, related: post.related.map((r) => live.find((x) => x.slug === r)).filter((x): x is BlogPost => !!x) };
}
