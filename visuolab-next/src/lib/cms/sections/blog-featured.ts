/** The featured article card: the article is chosen on the article (Featured); only the link text is copy. */
import { z } from "zod";
import { text } from "../primitives.ts";

export const blogFeaturedSchema = z.strictObject({
  linkLabel: text("Link text on the featured article", 24),
});
export type BlogFeaturedSection = z.infer<typeof blogFeaturedSchema>;
