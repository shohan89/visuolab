import { z } from "zod";

/* ---- slugs ---------------------------------------------------------------------------------------------------- */

/** Words a service slug may not be: they would shadow routes or confuse people. */
export const RESERVED_SLUGS = new Set(["new", "edit", "admin", "api", "index", "services", "service", "undefined", "null"]);
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export { slugify } from "../slug.ts";

/* ---- text ----------------------------------------------------------------------------------------------------- */

/** Rich text allows only <em>…</em> and <b>…</b>, balanced. Anything else with angle brackets is refused (it would show as plain text). */
export const richOk = (v: string): boolean => {
  const open = (v.match(/<(em|b)>/g) ?? []).length;
  const close = (v.match(/<\/(em|b)>/g) ?? []).length;
  if (open !== close) return false;
  return !/[<>]/.test(v.replace(/<\/?(em|b)>/g, ""));
};
/** Plain text: no angle brackets at all. */
const plainOk = (v: string) => !/[<>]/.test(v);

const plain = (label: string, max: number, min = 1) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`).refine(plainOk, `${label} cannot contain < or >`);
const rich = (label: string, max: number, min = 1) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`).refine(richOk, `${label}: only <em>…</em> and <b>…</b> are allowed, and they must be closed`);
/** Rich text that may be empty (a hidden section keeps whatever was typed, but it must still be safe). */
const optionalRich = (label: string, max: number) => z.string().trim().max(max, `${label} is too long (max ${max} characters)`).refine(richOk, `${label}: only <em>…</em> and <b>…</b> are allowed, and they must be closed`);
const optionalPlain = (label: string, max: number) => z.string().trim().max(max, `${label} is too long (max ${max} characters)`).refine(plainOk, `${label} cannot contain < or >`);

/** A link: a path on this site, an in-page anchor, a mail link or an https address. */
export const linkOk = (v: string) => /^(\/(?!\/)[^\s<>"']*|#[^\s<>"']*|mailto:[^\s<>"']+|https:\/\/[^\s<>"']+)$/.test(v);
const link = (label: string) => z.string().trim().min(1, `${label} is required`).max(300).refine(linkOk, `${label} must start with / # mailto: or https://`);

/* ---- the service form ----------------------------------------------------------------------------------------- */

const item = <T extends z.ZodRawShape>(shape: T) => z.object(shape);
const list = <T extends z.ZodTypeAny>(schema: T, label: string, min: number, max: number) =>
  z.array(schema).min(min, `${label}: add at least ${min}`).max(max, `${label}: at most ${max}`);

export const iconSchema = z.object({
  viewBox: z.string().regex(/^[\d.\s-]{3,40}$/),
  nodes: z.array(z.object({ t: z.enum(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]), a: z.record(z.string(), z.string().max(2000)) })).max(20),
});

export const STATUSES = ["draft", "published", "archived"] as const;

export const serviceSchema = z
  .object({
    title: plain("Name", 80),
    slug: z.string().trim().min(2, "Slug is required (at least 2 characters)").max(60, "Slug is too long (max 60 characters)").regex(SLUG_RE, "Slug can use lower-case letters, numbers and single hyphens only").refine((v) => !RESERVED_SLUGS.has(v), "That slug is reserved"),
    status: z.enum(STATUSES),
    metaTitle: plain("SEO title", 70),
    metaDescription: plain("SEO description", 200, 20),
    heroTitle: rich("Headline", 200),
    heroLead: plain("Intro text", 400),
    heroCtaLabel: plain("Button text", 40),
    heroCtaHref: link("Button link"),
    heroImageA: z.string().min(1, "Choose the featured image"),
    heroImageAAlt: optionalPlain("Featured image description", 200),
    heroImageB: z.string().min(1, "Choose the second image"),
    heroImageBAlt: optionalPlain("Second image description", 200),

    showProblems: z.boolean(),
    problems: item({
      label: optionalPlain("Problems: label", 60), title: optionalRich("Problems: heading", 200),
      items: list(item({ title: optionalPlain("Problem title", 100), text: optionalPlain("Problem text", 400), proofValue: optionalRich("Proof value", 40), proofLabel: optionalPlain("Proof label", 100) }), "Problems", 0, 8),
    }),
    overview: item({
      label: plain("Overview: label", 60), title: rich("Overview: heading", 200),
      blocks: list(item({ title: plain("Block title", 100), text: plain("Block text", 600) }), "Overview blocks", 1, 8),
    }),
    outcomes: item({
      label: plain("Outcomes: label", 60), title: rich("Outcomes: heading", 200),
      items: list(item({ value: rich("Outcome value", 40), text: plain("Outcome text", 300) }), "Outcomes", 1, 8),
    }),
    showBand: z.boolean(),
    band: item({ text: optionalRich("Call-to-action text", 200), ctaLabel: optionalPlain("Call-to-action button text", 40), ctaHref: z.string().trim().max(300).refine((v) => v === "" || linkOk(v), "Call-to-action link must start with / # mailto: or https://") }),
    included: item({
      label: plain("What is included: label", 60), title: rich("What is included: heading", 200),
      items: list(item({ title: plain("Item title", 100), text: plain("Item text", 400), icon: iconSchema }), "Included items", 1, 12),
    }),
    process: item({
      label: plain("Process: label", 60), title: rich("Process: heading", 200),
      steps: list(item({ title: plain("Step title", 100), duration: plain("Step duration", 40), text: plain("Step text", 400) }), "Process steps", 1, 10),
    }),
    casesLabel: plain("Case studies: label", 60),
    casesTitle: rich("Case studies: heading", 200),
    caseIds: z.array(z.string().min(1)).max(6, "Case studies: at most 6"),
  })
  .superRefine((v, ctx) => {
    if (v.heroImageA && v.heroImageA === v.heroImageB) ctx.addIssue({ code: "custom", path: ["heroImageB"], message: "Use two different images" });
    if (new Set(v.caseIds).size !== v.caseIds.length) ctx.addIssue({ code: "custom", path: ["caseIds"], message: "Each case study can be chosen once" });
    // sections that are switched off may be left unfinished; switched on, they must be complete
    const need = (ok: boolean, path: (string | number)[], message: string) => { if (!ok) ctx.addIssue({ code: "custom", path, message }); };
    if (v.showProblems) {
      need(v.problems.label !== "", ["problems", "label"], "Problems: label is required");
      need(v.problems.title !== "", ["problems", "title"], "Problems: heading is required");
      need(v.problems.items.length > 0, ["problems", "items"], "Problems: add at least 1 (or switch the section off)");
      v.problems.items.forEach((it, i) => {
        for (const k of ["title", "text", "proofValue", "proofLabel"] as const) need(it[k] !== "", ["problems", "items", i, k], `Problem ${i + 1}: ${k === "proofValue" ? "proof number" : k === "proofLabel" ? "proof label" : k} is required`);
      });
    }
    if (v.showBand) {
      need(v.band.text !== "", ["band", "text"], "Call-to-action text is required");
      need(v.band.ctaLabel !== "", ["band", "ctaLabel"], "Call-to-action button text is required");
      need(linkOk(v.band.ctaHref), ["band", "ctaHref"], "Call-to-action link must start with / # mailto: or https://");
    }
    if (v.status === "published" && v.caseIds.length === 0) ctx.addIssue({ code: "custom", path: ["caseIds"], message: "Choose at least one case study before publishing" });
  });

export type ServiceInput = z.infer<typeof serviceSchema>;
export type ServiceErrors = Record<string, string>;

/** Zod issues to { "overview.blocks.0.title": "Block title is required" }; the first message per field wins. */
export function toErrors(error: z.ZodError): ServiceErrors {
  const out: ServiceErrors = {};
  for (const i of error.issues) {
    const key = i.path.join(".") || "form";
    if (!(key in out)) out[key] = i.message;
  }
  return out;
}
