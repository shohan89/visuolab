/** FAQ on About: the intro with an optional button, and an accordion (the first answer starts open). An empty button link means "e-mail us". */
import { z } from "zod";
import { group, hint, hrefOpt, list, optText, rich, text } from "../primitives.ts";

export const faqAccordionSchema = z.strictObject({
  label: optText("Label", 30),
  title: rich("Heading", 60),
  lead: optText("Intro", 120),
  cta: group("Button", { label: text("Text", 24), href: hint(hrefOpt("Link"), "Leave empty to open an e-mail to the contact address.") }).nullable(),
  items: list(z.strictObject({ question: text("Question", 80), answer: text("Answer", 320) }), "Questions", 3, 10, "question"),
});
export type FaqAccordionSection = z.infer<typeof faqAccordionSchema>;
