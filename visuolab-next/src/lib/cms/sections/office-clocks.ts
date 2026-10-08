/** Offices on About: live clocks. Whether an office is "working now" and its time offset are worked out in code from the time zone. */
import { z } from "zod";
import { choice, list, optText, rich, text, timeZone } from "../primitives.ts";

/** The flags that exist as drawings in code. A new office country needs its flag drawn first, then added here. */
export const FLAGS = ["PT", "CA", "SG", "AU"] as const;
const FLAG_NAMES = { PT: "Portugal", CA: "Canada", SG: "Singapore", AU: "Australia" } as const;

export const officeClocksSchema = z.strictObject({
  label: optText("Label", 30),
  title: rich("Heading", 60),
  lead: optText("Intro", 240),
  items: list(z.strictObject({ timeZone, city: text("City", 20), country: text("Country", 24), flag: choice("Flag", FLAGS, FLAG_NAMES) }), "Offices", 2, 8, "office"),
});
export type OfficeClocksSection = z.infer<typeof officeClocksSchema>;
