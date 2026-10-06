import type { EmailMessage, EmailProvider, ProviderContext, SendResult } from "./types.ts";

/** Resend (https://resend.com), through its HTTP API. The only file that knows Resend's request and answer formats. */
export const DEFAULT_BASE = "https://api.resend.com";

export const resend: EmailProvider = {
  id: "resend",
  label: "Resend",
  secretName: "RESEND_API_KEY",

  async send(message: EmailMessage, ctx: ProviderContext): Promise<SendResult> {
    const doFetch = ctx.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
    try {
      const res = await doFetch(`${(ctx.baseUrl || DEFAULT_BASE).replace(/\/+$/, "")}/emails`, {
        method: "POST",
        // the key travels only in this header; it is not part of the body
        headers: { authorization: `Bearer ${ctx.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          subject: message.subject,
          text: message.text,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        let messageId: string | undefined;
        try {
          const body = (await res.json()) as { id?: unknown };
          if (typeof body.id === "string") messageId = body.id.slice(0, 100);
        } catch {
          /* an accepted message without a readable id is still accepted */
        }
        return { ok: true, messageId };
      }
      // 429 and 5xx can succeed later; 4xx (bad key, unverified sender, invalid address) will not until someone fixes the settings
      return { ok: false, retryable: res.status === 429 || res.status >= 500, reason: `mail provider answered ${res.status}` };
    } catch (e) {
      const timedOut = e instanceof Error && e.name === "AbortError";
      return { ok: false, retryable: true, reason: timedOut ? "timeout" : "could not reach the mail provider" };
    } finally {
      clearTimeout(timer);
    }
  },
};
