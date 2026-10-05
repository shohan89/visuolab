/*
 * Content mapping layer for blog articles.
 *
 *   database row ──mapBlogPost()──▶ BlogPost (src/content/types.ts) ──▶ BlogListing / BlogArticle
 *   database row ──rowToInput()───▶ BlogInput (admin form)
 *   BlogInput    ──inputToColumns()▶ column values for INSERT / UPDATE
 *
 * Pure functions: no database, no framework. The article body is a list of typed blocks (headings, paragraphs with a small inline
 * subset, lists, quotes, images, dividers). It is stored as JSON and rendered by React components; no HTML is stored or injected.
 */
import type { BlogBlock, BlogPost } from "../../content/types.ts";
import { plainInline } from "./inline.ts";
import type { BlogInput, StoredBlock } from "../validation/blog.ts";

export type Row = Record<string, unknown>;
export type MediaIndex = Record<string, string>;

const s = (v: unknown) => String(v ?? "");
const parse = <T>(v: unknown): T => JSON.parse(String(v)) as T;

/** Stored blocks → the blocks the page components take. An image whose file no longer exists is left out. */
export function mapBlocks(stored: StoredBlock[] | { type: string; text?: string }[], media: MediaIndex): BlogBlock[] {
  const out: BlogBlock[] = [];
  for (const b of stored as StoredBlock[]) {
    switch (b.type) {
      case "heading": case "subheading": case "paragraph": out.push({ type: b.type, text: b.text }); break;
      case "list": out.push({ type: "list", ordered: b.ordered, items: b.items }); break;
      case "quote": out.push({ type: "quote", text: b.text, cite: b.cite ?? "" }); break;
      case "image": { const src = media[b.media]; if (src) out.push({ type: "image", src, alt: b.alt ?? "", caption: b.caption ?? "" }); break; }
      case "divider": out.push({ type: "divider" }); break;
    }
  }
  return out;
}

/** One blog_posts row (joined with its category title) as the object the page components take. */
export function mapBlogPost(p: Row, media: MediaIndex, tags: string[] = []): BlogPost {
  const avatar = p.author_image_id ? media[s(p.author_image_id)] : undefined;
  const og = p.og_image_id ? media[s(p.og_image_id)] : undefined;
  return {
    slug: s(p.slug),
    meta: { title: s(p.meta_title), description: s(p.meta_description) },
    category: s(p.category_title),
    title: s(p.title),
    publishedAt: s(p.published_at).slice(0, 10),
    readMinutes: Number(p.read_minutes),
    author: { name: s(p.author_name), avatar: avatar ?? "" },
    cover: { src: media[s(p.cover_image_id)] ?? "", alt: s(p.cover_alt) },
    ...(p.excerpt ? { excerpt: s(p.excerpt) } : {}),
    lead: s(p.lead),
    body: mapBlocks(parse(p.body_json), media),
    outro: parse(p.outro_json),
    related: parse(p.related_json),
    // CMS extras (only when there is something to say)
    ...(p.featured ? { featured: true } : {}),
    ...(tags.length ? { tags } : {}),
    ...(p.canonical_url ? { canonicalUrl: s(p.canonical_url) } : {}),
    ...(og ? { ogImage: { src: og } } : {}),
    publishedAtIso: s(p.published_at),
    updatedAtIso: s(p.updated_at),
  };
}

/** Reading time from the words of the lead and the blocks (200 words a minute, at least 1). */
export function readingMinutes(lead: string, blocks: StoredBlock[]): number {
  const words = (t: string) => plainInline(t).split(/\s+/).filter(Boolean).length;
  let n = words(lead);
  for (const b of blocks) {
    if (b.type === "heading" || b.type === "subheading" || b.type === "paragraph") n += words(b.text);
    else if (b.type === "quote") n += words(b.text);
    else if (b.type === "list") n += b.items.reduce((a, i) => a + words(i), 0);
  }
  return Math.max(1, Math.ceil(n / 200));
}

/** `YYYY-MM-DDTHH:mm` (UTC) for a datetime-local field from a stored ISO timestamp. */
export const isoToLocalInput = (iso: unknown): string => (iso ? s(iso).slice(0, 16) : "");
/** …and back: the full ISO timestamp, or null for an empty field. */
export const localInputToIso = (v: string): string | null => (v ? new Date(`${v}:00Z`).toISOString() : null);

export function rowToInput(p: Row, tags: string[]): BlogInput {
  return {
    title: s(p.title), slug: s(p.slug), status: s(p.status) as BlogInput["status"], featured: Boolean(p.featured), categoryId: s(p.category_id), tags,
    excerpt: s(p.excerpt), lead: s(p.lead), blocks: parse<StoredBlock[]>(p.body_json), outro: parse(p.outro_json), related: parse(p.related_json),
    coverImage: s(p.cover_image_id), coverAlt: s(p.cover_alt), ogImage: s(p.og_image_id), canonicalUrl: s(p.canonical_url),
    metaTitle: s(p.meta_title), metaDescription: s(p.meta_description), authorName: s(p.author_name), authorImage: s(p.author_image_id),
    readMinutes: Number(p.read_minutes), publishedAt: isoToLocalInput(p.published_at),
  };
}

export function inputToColumns(i: BlogInput) {
  return {
    body_json: JSON.stringify(i.blocks),
    outro_json: JSON.stringify(i.outro),
    related_json: JSON.stringify(i.related),
    read_minutes: i.readMinutes ?? readingMinutes(i.lead, i.blocks),
    published_at: localInputToIso(i.publishedAt),
  };
}
