/** Manifesto on About: one paragraph whose words light up as you scroll. */
import { z } from "zod";
import { hint, rich, text } from "../primitives.ts";

export const manifestoSchema = z.strictObject({
  label: text("Label", 30),
  text: hint(rich("Text", 420), "The words light up as the visitor scrolls."),
});
export type ManifestoSection = z.infer<typeof manifestoSchema>;
