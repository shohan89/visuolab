/** Process on Home: the intro (with facts and a button) and the steps. */
import { z } from "zod";
import { link, list, rich, text } from "../primitives.ts";

export const processStepsSchema = z.strictObject({
  label: text("Label", 24),
  title: rich("Heading", 48),
  lead: text("Intro", 160),
  facts: list(text("Fact", 32), "Facts", 2, 4, "fact"),
  cta: link("Button", 24),
  /** 3 to 6: one step would break the rail between the steps, and more than six are too narrow. */
  steps: list(
    z.strictObject({
      label: text("Step name", 16),
      title: rich("Step heading", 48),
      text: text("Text", 170),
      outputs: list(text("Output", 24), "Outputs", 2, 4, "output"),
      when: text("Duration", 14),
    }),
    "Steps",
    3,
    6,
    "step",
  ),
});
export type ProcessStepsSection = z.infer<typeof processStepsSchema>;
