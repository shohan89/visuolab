/*
 * Character guidance for the SEO fields, shown while an editor types. Search engines cut a title at about 600 pixels (roughly 60 characters) and a
 * description at about 160 characters; the schema's hard limits are 70 and 200. Pure, so the admin and the checks use the same bands.
 */

export type Band = { level: "empty" | "short" | "good" | "long" | "over"; message: string };

export const TITLE = { good: [30, 60] as const, max: 70 };
export const DESCRIPTION = { good: [70, 160] as const, max: 200 };

function band(len: number, r: { good: readonly [number, number]; max: number }, what: string): Band {
  if (len === 0) return { level: "empty", message: `Empty: the default ${what} is used.` };
  if (len > r.max) return { level: "over", message: `Too long: ${len - r.max} over the limit of ${r.max}.` };
  if (len > r.good[1]) return { level: "long", message: `Long: search engines may cut it off after about ${r.good[1]} characters.` };
  if (len < r.good[0]) return { level: "short", message: `Short: ${r.good[0]} to ${r.good[1]} characters usually works best.` };
  return { level: "good", message: `Good length (${r.good[0]} to ${r.good[1]} characters).` };
}

export const titleBand = (len: number): Band => band(len, TITLE, "title");
export const descriptionBand = (len: number): Band => band(len, DESCRIPTION, "description");
