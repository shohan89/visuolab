/** Our cases on Home: the stacked case panels. Which cases, in which order; each panel's own words are the case study's "showcase" fields. */
import { z } from "zod";
import { caseIds, rich, text } from "../primitives.ts";

export const caseShowcaseSchema = z.strictObject({
  label: text("Label", 24),
  title: rich("Heading", 40),
  caseIds: caseIds("Case studies, in order", 2, 6),
  allLabel: text("All projects button", 24),
});
export type CaseShowcaseSection = z.infer<typeof caseShowcaseSchema>;
