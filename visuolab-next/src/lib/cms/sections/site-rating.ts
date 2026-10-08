/** The rating line next to the reviews ("5.0 ★★★★★ 60+ reviews on Clutch") and in the service hero. The stars are fixed. */
import { z } from "zod";
import { hint, text } from "../primitives.ts";

export const siteRatingSchema = z.strictObject({
  score: text("Score", 4),
  text: hint(text("Text", 40), "Shown as: 5.0 ★★★★★ followed by this text."),
});
export type SiteRatingSection = z.infer<typeof siteRatingSchema>;
