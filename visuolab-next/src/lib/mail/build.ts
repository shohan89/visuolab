/*
 * The messages the website sends, as provider-neutral EmailMessage objects (src/lib/integrations/email/types.ts). Pure: no secrets,
 * no network, so the verification script can check exactly what would be sent. A provider turns the message into its own request
 * and adds the key; the key is never part of what is built here.
 */
import type { EmailMessage } from "../integrations/email/types.ts";

export type MailSettings = { from: string; to: string[] };
export type Enquiry = { name: string; email: string; company?: string | null; service?: string | null; budget?: string | null; message: string; id: string };

/** One line, no control characters: safe to put in an email header such as the subject. */
export const oneLine = (s: string, max = 120): string => s.replace(/[\r\n\t\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);

export function enquiryEmail(settings: MailSettings, n: Enquiry): EmailMessage {
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
  // visitor input appears only in the plain-text body, the reply-to address and a sanitised subject
  return { from: settings.from, to: settings.to, replyTo: n.email, subject: `New enquiry from ${oneLine(n.name, 60)}`, text: lines.join("\n") };
}

export function testEmail(settings: MailSettings, siteName: string): EmailMessage {
  return { from: settings.from, to: settings.to, subject: `${oneLine(siteName, 40)}: test message`, text: `This is a test message from the ${oneLine(siteName, 40)} admin. If you can read it, enquiry notifications can be delivered to this address.` };
}
