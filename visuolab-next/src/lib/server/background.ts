import "server-only";
import { waitUntil } from "cloudflare:workers";

/**
 * Lets slow work finish after the visitor has been answered (the Worker stays alive until it ends). Used for outgoing integrations, so a
 * webhook that is slow or down never makes the contact form wait. Outside a request (tooling) the promise just runs on its own.
 */
export function background(work: Promise<unknown>): void {
  const safe = work.catch(() => {}); // the work records its own failures; nothing may become an unhandled rejection
  try {
    waitUntil(safe);
  } catch {
    /* no request context: `safe` still runs */
  }
}
