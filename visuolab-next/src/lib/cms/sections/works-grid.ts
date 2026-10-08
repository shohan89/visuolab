/** The grid of case study cards: every published case study, in the order set on the case studies. Only the "no match" text is copy. */
import { z } from "zod";
import { text } from "../primitives.ts";

export const worksGridSchema = z.strictObject({
  emptyText: text("Text when no case study matches the filter", 80),
});
export type WorksGridSection = z.infer<typeof worksGridSchema>;
