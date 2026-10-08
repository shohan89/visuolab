/** Works hero with the filter chips. The chip keys join to the case studies' filters; only the labels are editable (counts are worked out). */
import { z } from "zod";
import { group, hint, optText, rich, text } from "../primitives.ts";

export const worksHeroSchema = z.strictObject({
  label: optText("Label", 24),
  title: rich("Headline", 60),
  lead: text("Intro", 220),
  allLabel: text("\"All\" chip", 16),
  chipLabels: hint(group("Filter chip labels", {
    brand: text("Brand", 16),
    product: text("Product", 16),
    web: text("Web", 16),
    packaging: text("Packaging", 16),
    motion: text("Motion", 16),
  }), "The filters themselves are fixed: only the words change."),
});
export type WorksHeroSection = z.infer<typeof worksHeroSchema>;
