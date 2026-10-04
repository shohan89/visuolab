import "server-only";
import type { ContactInput } from "@/lib/validation/contact";

/** Names of the two decoy fields the form carries; real visitors never see or fill them. */
export const HONEYPOT_FIELD = "website";
export const STARTED_FIELD = "startedAt";

/** Anyone who submits sooner than this after the form appeared is not typing a message. */
export const MIN_FILL_MS = 2500;
/** A form open for more than a day is a stale tab or a replay. */
export const MAX_FILL_MS = 24 * 3600 * 1000;

export type SpamVerdict = { spam: false } | { spam: true; reason: string };

/** Cheap checks that need no third party. A "spam" verdict is stored with status "spam" and never shown to the visitor. */
export function judge(input: ContactInput, extras: { honeypot: string; startedAt: number | null; now?: number }): SpamVerdict {
  if (extras.honeypot.trim() !== "") return { spam: true, reason: "honeypot" };
  const now = extras.now ?? Date.now();
  if (extras.startedAt !== null) {
    const took = now - extras.startedAt;
    if (took < MIN_FILL_MS) return { spam: true, reason: "too-fast" };
    if (took > MAX_FILL_MS || took < 0) return { spam: true, reason: "stale-form" };
  }
  const text = `${input.message} ${input.name} ${input.company ?? ""}`;
  const links = text.match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (links > 2) return { spam: true, reason: "many-links" };
  if (/\[(url|link)=|<a\s+href|<script/i.test(text)) return { spam: true, reason: "markup" };
  return { spam: false };
}
