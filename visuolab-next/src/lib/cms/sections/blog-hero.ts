/** Blog hero with the topic chips (the chips are the blog categories; counts are worked out). */
import { z } from "zod";
import { optText, rich, text } from "../primitives.ts";

export const blogHeroSchema = z.strictObject({
  label: optText("Label", 24),
  title: rich("Headline", 70),
  lead: optText("Intro", 140),
  allLabel: text("\"All\" chip", 16),
});
export type BlogHeroSection = z.infer<typeof blogHeroSchema>;
