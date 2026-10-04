import { z } from "zod";
import { BUDGETS, NEEDS } from "@/content/contact";

/** Limits shared by the browser check and the server check. */
export const LIMITS = { name: 100, email: 254, company: 120, message: 5000, messageMin: 10 } as const;

const text = (max: number) => z.string().trim().max(max);

/**
 * The contact form, as the server accepts it. The same schema runs in the browser (for early feedback) and on the server
 * (the only check that counts). Fields not on the form are rejected, not ignored.
 */
export const contactSchema = z
  .object({
    name: text(LIMITS.name).min(1, "Please tell us your name."),
    email: z.string().trim().toLowerCase().max(LIMITS.email).pipe(z.email("Please enter a valid email address.")),
    company: text(LIMITS.company).optional(),
    need: z.array(z.enum(NEEDS)).max(NEEDS.length).default([]),
    budget: z.enum(BUDGETS).optional(),
    message: text(LIMITS.message).min(LIMITS.messageMin, `Please add a few details (at least ${LIMITS.messageMin} characters).`),
  })
  .strict();

export type ContactInput = z.infer<typeof contactSchema>;

/** Field name -> first error message, for showing next to the form. */
export type FieldErrors = Partial<Record<keyof ContactInput, string>>;

/** Turns the form fields (FormData or anything with the same get/getAll) into the shape the schema expects. */
export function readContactForm(data: { get(k: string): unknown; getAll(k: string): unknown[] }) {
  const str = (k: string) => (typeof data.get(k) === "string" ? (data.get(k) as string) : "");
  const budget = str("budget");
  return {
    name: str("name"),
    email: str("email"),
    company: str("company") || undefined,
    need: data.getAll("need").filter((v): v is string => typeof v === "string"),
    budget: budget || undefined,
    message: str("message"),
  };
}

export function validateContact(raw: ReturnType<typeof readContactForm>):
  | { ok: true; data: ContactInput }
  | { ok: false; fieldErrors: FieldErrors } {
  const parsed = contactSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "") as keyof ContactInput;
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, fieldErrors };
}

/** What the browser gets back from the server action. Nothing internal is ever included. */
export type ContactResult =
  | { ok: true }
  | { ok: false; code: "invalid"; fieldErrors: FieldErrors }
  | { ok: false; code: "rate_limited" | "server"; message: string };
