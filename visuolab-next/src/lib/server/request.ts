import "server-only";
import { headers } from "next/headers";
import { getEnv } from "./db";
import { sha256Hex } from "./crypto";

/**
 * Salt for hashes of visitor data. SESSION_SECRET must be set. Without it, plain-http local development falls back to a
 * fixed salt so the form still works; when SITE_URL is https (a real deployment) the request fails instead of hashing weakly.
 */
const salt = () => {
  const env = getEnv();
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if ((env.SITE_URL ?? "").startsWith("https://")) throw new Error("SESSION_SECRET is not set");
  return "dev-only-salt";
};

/** Salted, truncated hash of the visitor's IP address. The address itself is never stored or logged. */
export async function ipHash(h: Headers): Promise<string> {
  const ip = h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return (await sha256Hex(`${salt()}:ip:${ip}`)).slice(0, 32);
}

export async function valueHash(namespace: string, value: string): Promise<string> {
  return (await sha256Hex(`${salt()}:${namespace}:${value}`)).slice(0, 32);
}

/** The form may only be posted from this site: when the browser sends an Origin, its host must be ours. */
export function sameOrigin(h: Headers): boolean {
  const origin = h.get("origin");
  if (!origin) return true; // same-origin form posts from some browsers omit it; the other checks still apply
  const host = h.get("x-forwarded-host") || h.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const requestHeaders = () => headers();
