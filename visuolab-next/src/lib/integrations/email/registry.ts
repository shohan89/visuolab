import { resend } from "./resend.ts";
import type { EmailProvider, EmailProviderId } from "./types.ts";

/**
 * Every email provider the website can use. To add one (Postmark, SES, SendGrid, …): write a file like resend.ts that implements
 * EmailProvider, add its id to EMAIL_PROVIDER_IDS in types.ts, and add it here. The contact form, the notification service, the
 * admin screens and the delivery records need no change.
 */
const PROVIDERS: Record<Exclude<EmailProviderId, "none">, EmailProvider> = { resend };

export const providerFor = (id: string): EmailProvider | null => (id in PROVIDERS ? PROVIDERS[id as keyof typeof PROVIDERS] : null);
export const listProviders = (): EmailProvider[] => Object.values(PROVIDERS);
