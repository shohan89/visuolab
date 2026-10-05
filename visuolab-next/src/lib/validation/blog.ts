import { z } from "zod";
import { headingId } from "../slug.ts";
import { isSafeHref, linkTargets } from "../content/inline.ts";
import { RESERVED_SLUGS, SLUG_RE, STATUSES, linkOk, toErrors } from "./service.ts";

export { toErrors, STATUSES };

const plainOk = (v: string) => !/[<>]/.test(v);
/** Text around a link: leading and trailing spaces are part of the sentence and are kept. */
const spaced = (label: string, max: number) => z.string().max(max, `${label} is too long (max ${max} characters)`).refine(plainOk, `${label} cannot contain < or >`);
const plain = (label: string, max: number, min = 1) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`).refine(plainOk, `${label} cannot contain < or >`);

/** Article text: any characters (it is always shown as text, never run), at most `max`, and every [link](target) must be safe. */
const inlineText = (label: string, max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} is too long (max ${max} characters)`)
    .refine((v) => linkTargets(v).every(isSafeHref), `${label}: a link must start with / # mailto: or https://`);

/** Where the article's blocks are stored (the body_json column). Plain data: no HTML anywhere. */
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: plain("Heading", 140) }),
  z.object({ type: z.literal("subheading"), text: plain("Subheading", 140) }),
  z.object({ type: z.literal("paragraph"), text: inlineText("Paragraph", 3000) }),
  z.object({ type: z.literal("list"), ordered: z.boolean(), items: z.array(inlineText("List item", 400)).min(1, "A list needs at least one item").max(30, "A list can have at most 30 items") }),
  z.object({ type: z.literal("quote"), text: inlineText("Quote", 600), cite: plain("Quote source", 100, 0) }),
  z.object({ type: z.literal("image"), media: z.string().min(1, "Choose an image"), alt: plain("Image description", 200, 0), caption: plain("Image caption", 200, 0) }),
  z.object({ type: z.literal("divider") }),
]);
export type StoredBlock = z.infer<typeof blockSchema>;

const dateTime = z.string().trim().refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}:00Z`))), "Publish date must look like 2026-10-05T09:30");

export const blogSchema = z
  .object({
    title: plain("Title", 140),
    slug: z.string().trim().min(2, "Slug is required (at least 2 characters)").max(80, "Slug is too long (max 80 characters)").regex(SLUG_RE, "Slug can use lower-case letters, numbers and single hyphens only").refine((v) => !RESERVED_SLUGS.has(v), "That slug is reserved"),
    status: z.enum(STATUSES),
    featured: z.boolean(),
    categoryId: z.string().min(1, "Choose a category"),
    tags: z.array(plain("Tag", 30, 2)).max(8, "Tags: at most 8"),
    excerpt: plain("Excerpt", 300, 0),
    lead: inlineText("Opening paragraph", 600),
    blocks: z.array(blockSchema).min(1, "Add at least one block to the article").max(80, "An article can have at most 80 blocks"),
    outro: z.object({ before: spaced("Closing line: text before the link", 120), linkText: plain("Closing line: link text", 60), href: z.string().trim().min(1, "Closing line: link is required").max(300).refine(linkOk, "Closing line: link must start with / # mailto: or https://"), after: spaced("Closing line: text after the link", 160) }),
    related: z.array(z.string().min(1)).max(3, "More from the studio: at most 3"),
    coverImage: z.string().min(1, "Choose the featured image"),
    coverAlt: plain("Featured image description", 200, 0),
    ogImage: z.string(),
    canonicalUrl: z.string().trim().max(300).refine((v) => v === "" || /^https:\/\/[^\s<>"']+$/.test(v), "Canonical URL must be a full address starting with https://"),
    metaTitle: plain("SEO title", 70),
    metaDescription: plain("SEO description", 200, 20),
    authorName: plain("Author", 60),
    authorImage: z.string(),
    readMinutes: z.number().int("Reading time must be a whole number").min(1, "Reading time must be at least 1 minute").max(120).nullable(),
    publishedAt: dateTime,
  })
  .superRefine((v, ctx) => {
    const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    // two headings must not produce the same anchor in the table of contents
    const seen = new Map<string, number>();
    v.blocks.forEach((b, i) => {
      if (b.type !== "heading") return;
      const id = headingId(b.text, [...seen.keys()].length);
      if (seen.has(id)) add(["blocks", i], `Heading "${b.text}" makes the same anchor as an earlier heading; reword one of them`);
      seen.set(id, i);
    });
    if (new Set(v.related).size !== v.related.length) add(["related"], "Each article can be chosen once");
    if (v.related.includes(v.slug)) add(["related"], "An article cannot list itself");
    if (new Set(v.tags.map((t) => t.toLowerCase())).size !== v.tags.length) add(["tags"], "Each tag once");
    if (v.status === "published" && !v.publishedAt) add(["publishedAt"], "A published article needs a publish date");
  });

export type BlogInput = z.infer<typeof blogSchema>;
