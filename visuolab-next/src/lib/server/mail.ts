import "server-only";
import { getEnv } from "./db";

type Note = { name: string; email: string; company?: string; service?: string; budget?: string; message: string; id: string };

/** One line, no control characters: safe to put in an email header such as the subject. */
const oneLine = (s: string, max = 120) => s.replace(/[\r\n\t\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);

/**
 * Sends the "new enquiry" email through Resend. The body is plain text (nothing is interpreted as markup) and visitor
 * input only ever appears in the body, the reply-to address and a sanitised subject.
 * Returns an error string, or null when the provider accepted the message (or when no key is configured: nothing to send).
 */
export async function notifyNewSubmission(n: Note): Promise<string | null> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) return "not configured";
  const lines = [
    `Name: ${n.name}`,
    `Email: ${n.email}`,
    n.company ? `Company: ${n.company}` : null,
    n.service ? `Needs: ${n.service}` : null,
    n.budget ? `Budget: ${n.budget}` : null,
    "",
    n.message,
    "",
    `Submission ${n.id}`,
  ].filter((l): l is string => l !== null);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [env.MAIL_TO], reply_to: n.email, subject: `New enquiry from ${oneLine(n.name, 60)}`, text: lines.join("\n") }),
      signal: controller.signal,
    });
    return res.ok ? null : `mail provider answered ${res.status}`;
  } catch (e) {
    return e instanceof Error ? e.name : "mail error";
  } finally {
    clearTimeout(timer);
  }
}
