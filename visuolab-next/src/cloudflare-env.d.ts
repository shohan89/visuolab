/* Worker secrets are not in wrangler.jsonc (they are set with `wrangler secret put` / .dev.vars), so `wrangler types` does not know them. */
declare namespace Cloudflare {
  interface Env {
    /** Salt for IP hashes and secret for signed values. Required in production. */
    SESSION_SECRET?: string;
    /** Resend API key. Without it no notification email is sent; submissions are still stored. */
    RESEND_API_KEY?: string;
  }
}
