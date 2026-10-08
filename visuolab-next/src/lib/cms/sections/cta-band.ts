/** The closing call to action on every page but Contact. The e-mail address comes from Settings > Contact. */
import { z } from "zod";
import { fixedList, group, hint, hrefOpt, mediaRef, optText, rich, text } from "../primitives.ts";

export const ctaBandSchema = z.strictObject({
  title: rich("Heading", 60),
  lead: optText("Text", 160),
  /** An empty link means: mail the contact address. */
  primary: group("Button", { label: text("Text", 24), href: hint(hrefOpt("Link"), "Leave empty to use the default (the contact e-mail).") }),
  avatars: fixedList(mediaRef("Photo"), "Photos", 3, "photo"),
  floaters: fixedList(mediaRef("Floating picture"), "Floating pictures", 4, "picture"),
});
export type CtaBandSection = z.infer<typeof ctaBandSchema>;
