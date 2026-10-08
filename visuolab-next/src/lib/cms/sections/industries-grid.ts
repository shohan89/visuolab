/** Industries on Home: four cards (each has its own drawing, fixed by position). */
import { z } from "zod";
import { fixedList, rich, text } from "../primitives.ts";

export const industriesGridSchema = z.strictObject({
  label: text("Label", 24),
  title: rich("Heading", 60),
  lead: text("Intro", 220),
  items: fixedList(z.strictObject({ title: text("Title", 24), text: text("Text", 140) }), "Industries", 4, "industry"),
});
export type IndustriesGridSection = z.infer<typeof industriesGridSchema>;
