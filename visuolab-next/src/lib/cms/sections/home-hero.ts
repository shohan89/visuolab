/** Home hero: the pinned scene with the two hands. The art, the mesh and the stars are fixed in code; only the words are content. */
import { z } from "zod";
import { hint, link, optText, rich, text } from "../primitives.ts";

export const homeHeroSchema = z.strictObject({
  eyebrow: text("Eyebrow", 40),
  title: rich("Headline", 110),
  primaryCta: link("Main button", 24),
  secondaryCta: link("Second link", 24).nullable(),
  /** What a screen reader says about the scene. */
  sceneLabel: hint(optText("Description of the hands scene (for screen readers)", 200), "Leave empty to use the built-in description."),
});
export type HomeHeroSection = z.infer<typeof homeHeroSchema>;
