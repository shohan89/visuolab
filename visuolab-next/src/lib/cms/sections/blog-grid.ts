/** The grid of articles: every live article but the featured one. */
import { z } from "zod";
import { text } from "../primitives.ts";

export const blogGridSchema = z.strictObject({
  emptyText: text("Text when no article matches the filter", 80),
});
export type BlogGridSection = z.infer<typeof blogGridSchema>;
