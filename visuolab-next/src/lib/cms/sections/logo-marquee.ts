/** The "Trusted by" band (Home, and every service page). The names are the shared logo list (`logos-collection`). */
import { z } from "zod";
import { optText } from "../primitives.ts";

export const logoMarqueeSchema = z.strictObject({
  label: optText("Label", 30),
});
export type LogoMarqueeSection = z.infer<typeof logoMarqueeSchema>;
