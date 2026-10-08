/** Footer: the newsletter text, the six badge captions (the marks are the brands' own and fixed), the legal links and the copyright line. */
import { z } from "zod";
import { group, hint, hrefOpt, list, text } from "../primitives.ts";

const badge = (label: string) => group(label, { line1: text("First line", 24), line2: text("Second line", 24) });

export const footerExtrasSchema = z.strictObject({
  newsletterText: text("Newsletter text", 120),
  newsletterPlaceholder: text("Email placeholder", 40),
  badges: hint(group("Badge captions", { clutch: badge("Clutch"), dribbble: badge("Dribbble"), awwwards: badge("Awwwards"), webflow: badge("Webflow"), goodfirms: badge("GoodFirms"), behance: badge("Behance") }), "The marks are the brands' own and cannot be changed."),
  /** A link to "#" goes nowhere, as today, until the page it belongs to exists. */
  legal: hint(list(z.strictObject({ label: text("Text", 24), href: hrefOpt("Link") }), "Legal links", 0, 4, "link"), "A link to # goes nowhere until the page exists."),
  copyright: text("Copyright line", 60),
});
export type FooterExtrasSection = z.infer<typeof footerExtrasSchema>;
