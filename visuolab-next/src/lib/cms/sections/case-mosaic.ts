/** The scrolling strip of case studies under the About hero. Name, kind, picture and link come from each case study; the renderer repeats the list to fill the loop. */
import { z } from "zod";
import { caseIds, hint } from "../primitives.ts";

export const caseMosaicSchema = z.strictObject({
  caseIds: hint(caseIds("Projects in the strip", 3, 8), "Name, kind and picture come from each case study. The strip repeats them to fill the width."),
});
export type CaseMosaicSection = z.infer<typeof caseMosaicSchema>;
