/** About hero: copy beside the 3D scene (fixed). A newline in the headline is a line break (at most 3 lines). */
import { z } from "zod";
import { list, richLines, text } from "../primitives.ts";

export const aboutHeroSchema = z.strictObject({
  label: text("Label", 30),
  title: richLines("Headline", 90, 3),
  lead: text("Intro", 220),
  facts: list(text("Fact", 24), "Facts", 0, 5, "fact"),
});
export type AboutHeroSection = z.infer<typeof aboutHeroSchema>;
