/** Words around a case study that are the same on every case study. */
import { z } from "zod";
import { text } from "../primitives.ts";

export const caseStudyChromeSchema = z.strictObject({
  breadcrumbRoot: text("First breadcrumb", 16),
  allProjectsLabel: text("All projects button", 24),
});
export type CaseStudyChromeSection = z.infer<typeof caseStudyChromeSchema>;
