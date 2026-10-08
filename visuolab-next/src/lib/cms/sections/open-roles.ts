/** Open roles on About: each row opens an e-mail with the subject set. */
import { z } from "zod";
import { hint, list, optText, rich, text } from "../primitives.ts";

export const openRolesSchema = z.strictObject({
  label: optText("Label", 30),
  title: rich("Heading", 40),
  items: hint(list(z.strictObject({ title: text("Role", 48), meta: text("Details", 40), subject: text("E-mail subject", 80) }), "Roles", 0, 10, "role"), "Each row opens an e-mail to the contact address with this subject."),
});
export type OpenRolesSection = z.infer<typeof openRolesSchema>;
