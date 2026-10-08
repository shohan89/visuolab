/** Principles on About: a numbered list (the numbers are generated). */
import { z } from "zod";
import { hint, list, optText, rich, text } from "../primitives.ts";

export const principlesListSchema = z.strictObject({
  label: optText("Label", 30),
  title: rich("Heading", 60),
  lead: optText("Intro", 120),
  items: hint(list(z.strictObject({ title: text("Title", 40), text: text("Text", 140) }), "Principles", 3, 6, "principle"), "The numbers (01, 02, ...) are added automatically."),
});
export type PrinciplesListSection = z.infer<typeof principlesListSchema>;
