/** The wordmarks in the "Trusted by" bands (text, not pictures). */
import { z } from "zod";
import { choice, list, text, toggle } from "../primitives.ts";

export const LOGO_STYLES = ["plain", "caps", "serif", "mono"] as const;
const LOGO_STYLE_NAMES = { plain: "Plain", caps: "Capitals", serif: "Serif", mono: "Monospace" } as const;

export const logosCollectionSchema = z.strictObject({
  items: list(z.strictObject({ text: text("Name", 24), style: choice("Style", LOGO_STYLES, LOGO_STYLE_NAMES), dot: toggle("Dot", "Show a dot before the name") }), "Names", 6, 14, "name"),
});
export type LogosCollectionSection = z.infer<typeof logosCollectionSchema>;
