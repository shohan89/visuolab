/** Contact intro beside the form: heading, who answers, ways to reach us, and short facts. `{email}` in a text is the site's contact e-mail (Settings > Contact). */
import { z } from "zod";
import { group, hint, list, mediaRef, optText, rich, text } from "../primitives.ts";

export const contactIntroSchema = z.strictObject({
  label: text("Label", 24),
  title: rich("Headline", 70),
  who: group("Who answers", { avatar: mediaRef("Photo").nullable(), name: text("Name", 40), role: text("Role", 80) }).nullable(),
  direct: list(
    z.strictObject({
      label: optText("Label", 24),
      text: hint(text("Text", 60), "{email} is replaced by the contact e-mail from Settings."),
      /** Empty: a plain mailto link. Otherwise the subject of the e-mail that opens. */
      mailSubject: hint(optText("E-mail subject", 80), "Empty: a plain e-mail link."),
    }),
    "Ways to reach us",
    1,
    3,
    "way",
  ),
  facts: list(text("Fact", 40), "Facts", 0, 4, "fact"),
});
export type ContactIntroSection = z.infer<typeof contactIntroSchema>;
