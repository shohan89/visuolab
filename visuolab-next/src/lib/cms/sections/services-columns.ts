/** Services on Home: three columns of links (each with its own drawing, fixed by position) and the "book a call" bar. */
import { z } from "zod";
import { fixedList, group, link, list, mediaRef, rich, text } from "../primitives.ts";

export const servicesColumnsSchema = z.strictObject({
  label: text("Label", 24),
  title: rich("Heading", 60),
  lead: text("Intro", 160),
  columns: fixedList(z.strictObject({ title: text("Column title", 24), links: list(link("Service", 28), "Links", 4, 7, "link") }), "Columns", 3, "column"),
  bookBar: group("Book a call bar", {
    avatar: mediaRef("Photo").nullable(),
    name: text("Name", 40),
    role: text("Role", 60),
    text: text("Text", 140),
    cta: link("Button", 24),
  }),
});
export type ServicesColumnsSection = z.infer<typeof servicesColumnsSchema>;
