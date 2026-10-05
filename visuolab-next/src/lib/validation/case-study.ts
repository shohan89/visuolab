import { z } from "zod";
import { SLUG_RE, RESERVED_SLUGS, STATUSES, richOk, toErrors } from "./service";

export { toErrors, STATUSES };

const plainOk = (v: string) => !/[<>]/.test(v);
const plain = (label: string, max: number, min = 1) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`).refine(plainOk, `${label} cannot contain < or >`);
const optionalPlain = (label: string, max: number) => plain(label, max, 0);
const rich = (label: string, max: number, min = 1) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`).refine(richOk, `${label}: only <em>…</em> and <b>…</b> are allowed, and they must be closed`);
const list = <T extends z.ZodTypeAny>(schema: T, label: string, min: number, max: number) =>
  z.array(schema).min(min, `${label}: add at least ${min}`).max(max, `${label}: at most ${max}`);

/** The disciplines the /works filter chips know. */
export const DISCIPLINES = ["brand", "product", "web", "packaging", "motion"] as const;

/** "20% 30%": where the picture is anchored when it is cropped. Empty = default. */
const objectPosition = z.string().trim().max(20).refine((v) => v === "" || /^\d{1,3}% \d{1,3}%$/.test(v), "Crop position looks like 20% 30%");

const shot = z.object({
  media: z.string().min(1, "Choose an image"),
  caption: plain("Caption", 160, 0),
  alt: optionalPlain("Image description", 200),
  position: objectPosition,
});

export const caseStudySchema = z
  .object({
    title: rich("Headline", 200),
    slug: z.string().trim().min(2, "Slug is required (at least 2 characters)").max(60, "Slug is too long (max 60 characters)").regex(SLUG_RE, "Slug can use lower-case letters, numbers and single hyphens only").refine((v) => !RESERVED_SLUGS.has(v), "That slug is reserved"),
    status: z.enum(STATUSES),
    featured: z.boolean(),

    clientName: plain("Client name", 60),
    clientFull: plain("Client (full name)", 80),
    industry: plain("Industry", 80),
    services: plain("Services", 160),
    year: z.string().trim().regex(/^(19|20)\d{2}$/, "Year must be 4 digits, like 2026"),
    timeline: plain("Timeline", 40),

    typeLine: plain("Card type line", 80),
    shortKind: plain("Short label", 40),
    cardTags: list(plain("Tag", 24), "Tags", 1, 4),
    filters: list(z.enum(DISCIPLINES), "Filters", 1, 5),
    cardImage: z.string().min(1, "Choose the card image"),
    cardImageAlt: plain("Card image description", 200),
    coverImage: z.string().min(1, "Choose the hero image"),
    coverImageAlt: plain("Hero image description", 200),

    metaTitle: plain("SEO title", 70),
    metaDescription: plain("SEO description", 200, 20),

    aboutLabel: plain("Description: label", 60),
    description: rich("Description", 600),
    stats: list(z.object({ value: rich("Number", 24), label: plain("Number label", 100) }), "Numbers", 1, 4),

    galleryA: list(shot, "First gallery", 1, 6),
    process: z.object({
      label: plain("Approach: label", 60),
      title: rich("Approach: heading", 200),
      steps: list(
        z.object({
          title: plain("Step title", 100),
          duration: plain("Step duration", 40),
          text: plain("Step text", 500),
          deliverables: list(z.object({ title: plain("Deliverable", 100), detail: plain("Deliverable detail", 200) }), "Deliverables", 0, 8),
        }),
        "Approach steps", 1, 8,
      ),
    }),
    galleryB: list(shot, "Second gallery", 1, 6),
    challenges: z.object({
      label: plain("Challenge: label", 60),
      title: rich("Challenge: heading", 200),
      items: list(z.object({ title: plain("Challenge title", 100), text: plain("Challenge text", 500) }), "Challenges", 1, 8),
    }),
    wide: shot,
    results: z.object({
      label: plain("Results: label", 60),
      title: rich("Results: heading", 200),
      items: list(z.object({ metric: z.boolean(), text: rich("Result", 300) }), "Results", 1, 10),
    }),
    more: z.object({ label: plain("More work: label", 60), title: rich("More work: heading", 200), slugs: list(z.string().min(1), "More work", 1, 4) }),

    showcase: z.object({
      title: rich("Card headline", 200),
      tags: list(plain("Card tag", 24), "Card tags", 1, 4),
      variant: z.enum(["results", "quote"]),
      results: z.array(z.object({ value: rich("Result number", 24, 0), text: plain("Result text", 140, 0) })).max(4),
      quote: z.object({ source: plain("Quote source", 60, 0), text: plain("Quote", 400, 0), avatar: z.string().trim().max(200).refine((v) => v === "" || /^\/[^\s<>"']*$/.test(v), "Avatar must be a path starting with /"), name: plain("Quote name", 60, 0), role: plain("Quote role", 80, 0) }),
    }),
    serviceIds: z.array(z.string().min(1)).max(10),
  })
  .superRefine((v, ctx) => {
    const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    if (v.cardTags.length !== new Set(v.cardTags).size) add(["cardTags"], "Each tag once");
    if (new Set(v.filters).size !== v.filters.length) add(["filters"], "Each filter once");
    if (new Set(v.more.slugs).size !== v.more.slugs.length) add(["more", "slugs"], "Each project can be chosen once");
    if (v.more.slugs.includes(v.slug)) add(["more", "slugs"], "A case study cannot list itself under More work");
    if (v.showcase.variant === "results") {
      if (v.showcase.results.length === 0) add(["showcase", "results"], "Card results: add at least 1 (or use a quote)");
      v.showcase.results.forEach((r, i) => {
        if (!r.value) add(["showcase", "results", i, "value"], `Card result ${i + 1}: number is required`);
        if (!r.text) add(["showcase", "results", i, "text"], `Card result ${i + 1}: text is required`);
      });
    } else {
      for (const k of ["source", "text", "name", "role"] as const) if (!v.showcase.quote[k]) add(["showcase", "quote", k], `Quote ${k} is required`);
      if (!v.showcase.quote.avatar) add(["showcase", "quote", "avatar"], "Quote avatar is required");
    }
  });

export type CaseStudyInput = z.infer<typeof caseStudySchema>;
