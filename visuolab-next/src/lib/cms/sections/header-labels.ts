/** The two words of the header's Services dropdown that are not links: the button's label and the small heading above its cards. */
import { z } from "zod";
import { hint, text } from "../primitives.ts";

export const headerLabelsSchema = z.strictObject({
  servicesLabel: hint(text("Services menu button", 24), "The word on the button that opens the Services dropdown (desktop header and mobile menu)."),
  departmentsLabel: hint(text("Dropdown heading", 40), "The small heading above the cards in the Services dropdown."),
});
export type HeaderLabelsSection = z.infer<typeof headerLabelsSchema>;
