/** The contact form's words: labels, placeholders, the two option lists, and the messages. The field names, rules and what is sent are fixed in code. The option lists are also what the server accepts, so a message is checked against them (never a second copy in code). */
import { z } from "zod";
import { group, hint, list, optText, text } from "../primitives.ts";

const field = (label: string, placeholderMax = 80) => group(label, { label: text("Label", 40), placeholder: optText("Placeholder", placeholderMax) });
const options = (label: string) =>
  list(text("Option", 30), `${label} options`, 3, 7, "option").refine((v) => new Set(v.map((o) => o.toLowerCase())).size === v.length, `${label}: an option appears twice`);

export const contactFormSchema = z.strictObject({
  name: field("Name field"),
  email: field("Email field"),
  company: field("Company field"),
  message: field("Message field", 120),
  needLegend: text("\"What do you need\" question", 40),
  needOptions: hint(options("Need"), "These are also the only choices the server accepts."),
  budgetLegend: text("Budget question", 40),
  budgetOptions: options("Budget"),
  submitLabel: text("Send button", 24),
  note: text("Note under the form", 200),
  success: text("Message after sending", 200),
  /** `{email}` is replaced by the site's contact e-mail. */
  error: hint(text("Message when sending fails", 200), "{email} is replaced by the contact e-mail."),
});
export type ContactFormSection = z.infer<typeof contactFormSchema>;
