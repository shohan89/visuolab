/** Story timeline on About: five columns. */
import { z } from "zod";
import { fixedList, optText, rich, text } from "../primitives.ts";

export const timelineSchema = z.strictObject({
  label: optText("Label", 30),
  title: rich("Heading", 100),
  items: fixedList(z.strictObject({ year: text("Year", 4), title: text("Title", 36), text: text("Text", 150) }), "Milestones", 5, "milestone"),
});
export type TimelineSection = z.infer<typeof timelineSchema>;
