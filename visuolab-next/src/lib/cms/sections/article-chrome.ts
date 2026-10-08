/** Words around an article that are the same on every article. */
import { z } from "zod";
import { rich, text } from "../primitives.ts";

export const articleChromeSchema = z.strictObject({
  breadcrumbRoot: text("First breadcrumb", 16),
  tocLabel: text("Contents label", 24),
  shareLabel: text("Share label", 16),
  relatedLabel: text("Related label", 24),
  relatedTitle: rich("Related heading", 40),
  relatedAllLabel: text("All articles button", 24),
});
export type ArticleChromeSection = z.infer<typeof articleChromeSchema>;
