/*
 * The sections of an article page (/blog/<slug>), in the order they appear, plus the listing card and the search settings.
 * Taken from components/site/blog/BlogArticle.tsx. The article body is already a list of typed blocks (headings, paragraphs, lists, quotes,
 * pictures, dividers), not one long text; the "Article body" section edits that list.
 */
import { z } from "zod";
import { blockSchema, type BlogInput } from "../../validation/blog.ts";
import { blocks, dateTime, hint, list, mediaOnly, mediaRef, optText, pick, pickOne, text, toggle, whole } from "../primitives.ts";
import { inline, recordHref, spaced } from "./common.ts";
import { section, type EntitySection } from "./types.ts";

type I = BlogInput;
const HEAD_E = "Visitors lose the headline, the category in the breadcrumb, the author, the date and the reading time (the page's <h1>, which search engines and screen readers rely on).";
const LOCK_SEO = "The search settings are not drawn on the page; they go into its head (title, description, share picture), so there is nothing to hide.";
type Pic = { id: string } | null;
const pic = (id: string): Pic => (id ? { id } : null);

export const BLOG_SECTIONS: readonly EntitySection<I>[] = [
  section<I, z.ZodType<{ title: string; categoryId: string; authorName: string; authorImage: Pic; publishedAt: string; readMinutes: number | null }>>({
    key: "header", confirm: HEAD_E, name: "Headline and byline", type: "Article header", anchor: "top",
    about: "The headline, the category in the breadcrumb, the author, the date and the reading time.",
    schema: z.strictObject({
      title: text("Headline", 140),
      categoryId: pickOne("Category", "categories"),
      authorName: text("Author", 60),
      authorImage: mediaOnly("Author picture").nullable(),
      publishedAt: hint(dateTime("Publish date"), "Year-month-day, then T, then the time (UTC). In the future means scheduled."),
      readMinutes: hint(whole("Reading time", 1, 120).nullable(), "Minutes. Leave empty to work it out from the text."),
    }),
    read: (i) => ({ title: i.title, categoryId: i.categoryId, authorName: i.authorName, authorImage: pic(i.authorImage), publishedAt: i.publishedAt, readMinutes: i.readMinutes }),
    apply: (i, c) => ({ ...i, title: c.title, categoryId: c.categoryId, authorName: c.authorName, authorImage: c.authorImage?.id ?? "", publishedAt: c.publishedAt, readMinutes: c.readMinutes }),
    map: { title: "title", categoryId: "categoryId", authorName: "authorName", authorImage: "authorImage.id", publishedAt: "publishedAt", readMinutes: "readMinutes" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ image: { id: string; alt: string } }>>({
    key: "cover", name: "Cover picture", type: "Large picture",
    about: "The large picture under the headline.",
    schema: z.strictObject({ image: mediaRef("Cover picture") }),
    read: (i) => ({ image: { id: i.coverImage, alt: i.coverAlt } }),
    apply: (i, c) => ({ ...i, coverImage: c.image.id, coverAlt: c.image.alt }),
    map: { coverImage: "image.id", coverAlt: "image.alt" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ lead: string }>>({
    key: "intro", name: "Opening paragraph", type: "Lead paragraph",
    about: "The first paragraph, set larger than the rest.",
    schema: z.strictObject({ lead: inline("Opening paragraph", 600) }),
    read: (i) => ({ lead: i.lead }),
    apply: (i, c) => ({ ...i, lead: c.lead }),
    map: { lead: "lead" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ blocks: I["blocks"] }>>({
    key: "body", confirm: "Visitors lose the article text and its table of contents: the page would show only the headline and the closing line.", name: "Article body", type: "Block editor",
    about: "The article itself, block by block: headings (they make the table of contents), paragraphs, lists, quotes, pictures and dividers.",
    schema: z.strictObject({ blocks: blocks(blockSchema, "Blocks", 1, 80) }),
    read: (i) => ({ blocks: i.blocks }),
    apply: (i, c) => ({ ...i, blocks: c.blocks }),
    map: { blocks: "blocks" },
  }) as EntitySection<I>,

  section<I, z.ZodType<I["outro"]>>({
    key: "closing-line", name: "Closing line", type: "Sentence with a link",
    about: "The last line after the rule: some words, a link, and some more words.",
    schema: z.strictObject({
      before: hint(spaced("Text before the link", 120), "Keep the space before the link."),
      linkText: text("Link text", 60),
      href: recordHref("Link"),
      after: hint(spaced("Text after the link", 160), "Starts with the punctuation that follows the link, for example a full stop."),
    }),
    read: (i) => i.outro,
    apply: (i, c) => ({ ...i, outro: c }),
    map: { outro: "" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ related: string[] }>>({
    key: "more-from-the-studio", name: "More from the studio", type: "Related articles", anchor: "more-title",
    about: "Up to three other articles suggested at the bottom. Only live articles are shown to visitors.",
    schema: z.strictObject({ related: pick("Article", "post_slugs", 0, 3, "article") }),
    read: (i) => ({ related: i.related }),
    apply: (i, c) => ({ ...i, related: c.related }),
    map: { related: "related" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ excerpt: string; tags: string[]; featured: boolean }>>({
    key: "listing", lock: "This is how the article appears on the Blog page and in tags, not a block of the article itself. To keep it off the Blog page, unpublish it under Basics and publishing.", name: "Listing card and tags", type: "Blog listing",
    about: "How the article appears on the Blog page: the teaser on the featured card, its tags, and whether it is the featured article.",
    schema: z.strictObject({
      excerpt: hint(optText("Teaser", 300), "Shown on the featured card only."),
      tags: list(text("Tag", 30, 2), "Tags", 0, 8, "tag").refine((v) => new Set(v.map((t) => t.toLowerCase())).size === v.length, "Each tag once"),
      featured: toggle("Featured", "Show this article as the featured one (only one article is featured at a time)"),
    }),
    read: (i) => ({ excerpt: i.excerpt, tags: i.tags, featured: i.featured }),
    apply: (i, c) => ({ ...i, excerpt: c.excerpt, tags: c.tags, featured: c.featured }),
    map: { excerpt: "excerpt", tags: "tags", featured: "featured" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ metaTitle: string; metaDescription: string; canonicalUrl: string; ogImage: Pic }>>({
    key: "seo", lock: LOCK_SEO, name: "Search engines (SEO)", type: "Search settings",
    about: "The title and description shown in search results and when the article is shared. Separate from the headline.",
    schema: z.strictObject({
      metaTitle: hint(text("SEO title", 70), "About 60 characters."),
      metaDescription: hint(text("SEO description", 200, 20), "About 150–160 characters."),
      canonicalUrl: hint(z.string().trim().max(300).refine((v) => v === "" || /^https:\/\/[^\s<>"']+$/.test(v), "Canonical URL must be a full address starting with https://").meta({ kind: "text", label: "Canonical URL" }), "Only if another address is the original. Empty: this page."),
      ogImage: hint(mediaOnly("Share picture").nullable(), "The picture shown when the article is shared. Empty: the cover picture."),
    }),
    read: (i) => ({ metaTitle: i.metaTitle, metaDescription: i.metaDescription, canonicalUrl: i.canonicalUrl, ogImage: pic(i.ogImage) }),
    apply: (i, c) => ({ ...i, metaTitle: c.metaTitle, metaDescription: c.metaDescription, canonicalUrl: c.canonicalUrl, ogImage: c.ogImage?.id ?? "" }),
    map: { metaTitle: "metaTitle", metaDescription: "metaDescription", canonicalUrl: "canonicalUrl", ogImage: "ogImage.id" },
  }) as EntitySection<I>,
];
