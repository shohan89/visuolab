/** "Why us": a label, a heading and a list of links, then the four numbers under it (a 4-column grid). */
import { z } from "zod";
import { fixedList, hint, link, list, rich, text } from "../primitives.ts";

export const whyStatsSchema = z.strictObject({
  label: text("Label", 24),
  title: rich("Heading", 80),
  items: list(link("Reason", 48), "Reasons (links)", 3, 8, "reason"),
  stats: fixedList(z.strictObject({ value: hint(rich("Number", 24), "For example 9<em>+</em>"), label: text("Label", 28) }), "Numbers", 4, "number"),
});
export type WhyStatsSection = z.infer<typeof whyStatsSchema>;
