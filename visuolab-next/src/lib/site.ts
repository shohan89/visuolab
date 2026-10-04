const FALLBACK = "http://localhost:3001";

/**
 * The canonical origin of the site (no trailing slash). It comes from the SITE_URL variable in wrangler.jsonc;
 * canonical links, Open Graph URLs and share links are built from it. Set it to the real domain before deploying.
 */
export async function getSiteUrl(): Promise<string> {
  let value: string | undefined;
  try {
    const { env } = await import("cloudflare:workers");
    value = (env as { SITE_URL?: string }).SITE_URL;
  } catch {
    value = process.env.SITE_URL; // outside the Workers runtime (build step, tooling)
  }
  return (value || FALLBACK).replace(/\/+$/, "");
}

export const SITE_NAME = "Visuolab";
