/*
 * The sections of a service page (/services/<slug>), in the order they appear. Taken from components/site/service/ServicePage.tsx.
 * The "Trusted by" logos, the rating line and the reviews are the same on every service page and are edited once, under Pages → Shared.
 */
import { z } from "zod";
import type { ServiceInput } from "../../validation/service.ts";
import { iconSchema } from "../../validation/service.ts";
import { group, hidden, hint, list, mediaRef, optText, pick, rich, text } from "../primitives.ts";
import { optRich, recordHrefOpt, recordLink } from "./common.ts";
import { section, type EntitySection } from "./types.ts";

type I = ServiceInput;
const HERO_E = "Visitors lose the page headline, the intro text, the button and the two pictures (the page's <h1>, which search engines and screen readers rely on).";
const LOCK_SEO = "The search settings are not drawn on the page; they go into its head (title, description, share picture), so there is nothing to hide.";

/** A plain circle: what a new "included" item gets until icons can be chosen. */
export const DEFAULT_ICON = { viewBox: "0 0 24 24", nodes: [{ t: "circle", a: { cx: "12", cy: "12", r: "8" } }] };

export const SERVICE_SECTIONS: readonly EntitySection<I>[] = [
  section<I, z.ZodType<{ title: string; lead: string; cta: { label: string; href: string }; imageA: { id: string; alt: string }; imageB: { id: string; alt: string } }>>({
    key: "hero", confirm: HERO_E, name: "Hero", type: "Hero with button and pictures", anchor: "top",
    about: "The headline, the intro text, the button and the two pictures beside them.",
    schema: z.strictObject({
      title: rich("Headline", 200),
      lead: text("Intro text", 400),
      cta: recordLink("Button", 40),
      imageA: mediaRef("Featured picture"),
      imageB: mediaRef("Second picture"),
    }).superRefine((v, ctx) => {
      if (v.imageA.id && v.imageA.id === v.imageB.id) ctx.addIssue({ code: "custom", path: ["imageB", "id"], message: "Use two different pictures" });
    }),
    read: (i) => ({ title: i.heroTitle, lead: i.heroLead, cta: { label: i.heroCtaLabel, href: i.heroCtaHref }, imageA: { id: i.heroImageA, alt: i.heroImageAAlt }, imageB: { id: i.heroImageB, alt: i.heroImageBAlt } }),
    apply: (i, c) => ({ ...i, heroTitle: c.title, heroLead: c.lead, heroCtaLabel: c.cta.label, heroCtaHref: c.cta.href, heroImageA: c.imageA.id, heroImageAAlt: c.imageA.alt, heroImageB: c.imageB.id, heroImageBAlt: c.imageB.alt }),
    map: { heroTitle: "title", heroLead: "lead", heroCtaLabel: "cta.label", heroCtaHref: "cta.href", heroImageA: "imageA.id", heroImageAAlt: "imageA.alt", heroImageB: "imageB.id", heroImageBAlt: "imageB.alt" },
  }) as EntitySection<I>,

  {
    ...section<I, z.ZodType<I["problems"]>>({
      key: "problems", name: "What we fix", type: "Problem cards with proof", anchor: "prob-title",
      about: "Problems clients come with, each with a proof number. The section exists on the page but is hidden today; switch it on when it is ready.",
      schema: z.strictObject({
        label: optText("Small label", 60),
        title: optRich("Heading", 200),
        items: list(group("Problem", { title: optText("Title", 100), text: optText("Text", 400), proofValue: optRich("Proof number", 40), proofLabel: optText("Proof label", 100) }), "Problems", 0, 8, "problem"),
      }),
      read: (i) => i.problems,
      apply: (i, c) => ({ ...i, problems: c }),
      map: { problems: "" },
    }),
    toggle: { read: (i) => i.showProblems, write: (i, on) => ({ ...i, showProblems: on }) },
  },

  section<I, z.ZodType<I["overview"]>>({
    key: "overview", name: "Overview", type: "Intro with text blocks", anchor: "ov-title",
    about: "What the service is, in a few short blocks.",
    schema: z.strictObject({
      label: text("Small label", 60),
      title: rich("Heading", 200),
      blocks: list(group("Block", { title: text("Title", 100), text: text("Text", 600) }), "Blocks", 1, 8, "block"),
    }),
    read: (i) => i.overview,
    apply: (i, c) => ({ ...i, overview: c }),
    map: { overview: "" },
  }) as EntitySection<I>,

  section<I, z.ZodType<I["outcomes"]>>({
    key: "outcomes", name: "Outcomes", type: "Numbers with captions", anchor: "out-title",
    about: "What the service achieves, as big numbers with a line each.",
    schema: z.strictObject({
      label: text("Small label", 60),
      title: rich("Heading", 200),
      items: list(group("Outcome", { value: hint(rich("Number", 40), "For example 3<em>×</em>"), text: text("Text", 300) }), "Outcomes", 1, 8, "outcome"),
    }),
    read: (i) => i.outcomes,
    apply: (i, c) => ({ ...i, outcomes: c }),
    map: { outcomes: "" },
  }) as EntitySection<I>,

  {
    ...section<I, z.ZodType<{ text: string; ctaLabel: string; ctaHref: string }>>({
      key: "call-to-action", name: "Call to action band", type: "Banner with button",
      about: "A short banner with a button between the outcomes and what is included. It exists on the page but is hidden today.",
      schema: z.strictObject({ text: optRich("Text", 200), ctaLabel: optText("Button text", 40), ctaHref: recordHrefOpt("Button link") }),
      read: (i) => i.band,
      apply: (i, c) => ({ ...i, band: c }),
      map: { band: "" },
    }),
    toggle: { read: (i) => i.showBand, write: (i, on) => ({ ...i, showBand: on }) },
  },

  section<I, z.ZodType<I["included"]>>({
    key: "included", name: "What is included", type: "Icon cards", anchor: "incl-title",
    about: "What the client gets. Each card keeps its icon; a new card starts with a plain circle.",
    schema: z.strictObject({
      label: text("Small label", 60),
      title: rich("Heading", 200),
      items: list(group("Item", { title: text("Title", 100), text: text("Text", 400), icon: hidden(iconSchema, DEFAULT_ICON) }), "Items", 1, 12, "item"),
    }),
    read: (i) => i.included,
    apply: (i, c) => ({ ...i, included: c }),
    map: { included: "" },
  }) as EntitySection<I>,

  section<I, z.ZodType<I["process"]>>({
    key: "process", name: "Process", type: "Step-by-step process", anchor: "proc-title",
    about: "How the work runs, step by step, with how long each step takes.",
    schema: z.strictObject({
      label: text("Small label", 60),
      title: rich("Heading", 200),
      steps: list(group("Step", { title: text("Title", 100), duration: hint(text("How long", 40), "For example: 2 weeks"), text: text("Text", 400) }), "Steps", 1, 10, "step"),
    }),
    read: (i) => i.process,
    apply: (i, c) => ({ ...i, process: c }),
    map: { process: "" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ label: string; title: string; caseIds: string[] }>>({
    key: "case-studies", name: "Case studies", type: "Case study cards", anchor: "cases-title",
    about: "The projects shown at the end of the page. Only published case studies are shown to visitors.",
    schema: z.strictObject({ label: text("Small label", 60), title: rich("Heading", 200), caseIds: pick("Case study", "case_ids", 0, 6, "case study") }),
    read: (i) => ({ label: i.casesLabel, title: i.casesTitle, caseIds: i.caseIds }),
    apply: (i, c) => ({ ...i, casesLabel: c.label, casesTitle: c.title, caseIds: c.caseIds }),
    map: { casesLabel: "label", casesTitle: "title", caseIds: "caseIds" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ metaTitle: string; metaDescription: string }>>({
    key: "seo", lock: LOCK_SEO, name: "Search engines (SEO)", type: "Search settings",
    about: "The title and description shown in search results and when the page is shared. Separate from the headline.",
    schema: z.strictObject({
      metaTitle: hint(text("SEO title", 70), "About 60 characters."),
      metaDescription: hint(text("SEO description", 200, 20), "About 150–160 characters."),
    }),
    read: (i) => ({ metaTitle: i.metaTitle, metaDescription: i.metaDescription }),
    apply: (i, c) => ({ ...i, ...c }),
    map: { metaTitle: "metaTitle", metaDescription: "metaDescription" },
  }) as EntitySection<I>,
];
