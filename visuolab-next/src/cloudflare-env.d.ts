/* Worker secrets are not in wrangler.jsonc (they are set with `wrangler secret put` / .dev.vars), so `wrangler types` does not know them. */
declare namespace Cloudflare {
  interface Env {
    /** Salt for IP hashes and secret for signed values. Required in production. */
    SESSION_SECRET?: string;
    /** Resend API key. Without it no notification email is sent; submissions are still stored. */
    RESEND_API_KEY?: string;
    /** Turnstile secret key (Cloudflare secret). Verifies the visitor's proof on the server. */
    TURNSTILE_SECRET?: string;
    /** Webhook integration: address to POST to (secret: it can carry a token) and the optional key that signs each message. */
    WEBHOOK_URL?: string;
    WEBHOOK_SECRET?: string;
    /** CRM webhook integration: incoming-webhook address and an optional Bearer token. */
    CRM_WEBHOOK_URL?: string;
    CRM_WEBHOOK_TOKEN?: string;
    /** Slack incoming-webhook address (https://hooks.slack.com/services/...). */
    SLACK_WEBHOOK_URL?: string;
    /** "1" lets webhook addresses be http or local. Development and tests only; never set in production. */
    INTEGRATIONS_ALLOW_HTTP?: string;
    /** Optional: Turnstile verification address when it is reached through a proxy (or a test server). */
    TURNSTILE_VERIFY_URL?: string;
    /** "1" turns the page cache in src/worker.ts on (the default in wrangler.jsonc); "0" in .dev.vars for local development and tests. */
    EDGE_CACHE?: string;
    /** Public origin of the media domain in front of the R2 bucket, e.g. https://media.example.com. Empty: the Worker serves /media/* itself. */
    MEDIA_BASE_URL?: string;
    /** Optional: address of the email provider API when it is reached through a proxy (or a test server). Empty: the provider's own address. */
    EMAIL_API_BASE?: string;
    /** "1" when Cloudflare Image Transformations are enabled on the zone (admin thumbnails then use /cdn-cgi/image). */
    IMAGE_TRANSFORMS?: string;
  }
}
