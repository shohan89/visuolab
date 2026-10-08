/** Mission and vision on About: two cards side by side. The pair is part of the design. */
import { z } from "zod";
import { group, optText, text } from "../primitives.ts";

const card = (label: string) => group(label, { tag: optText("Small label", 30), title: text("Title", 16), text: text("Text", 260) });

export const missionVisionSchema = z.strictObject({
  mission: card("Mission"),
  vision: card("Vision"),
});
export type MissionVisionSection = z.infer<typeof missionVisionSchema>;
