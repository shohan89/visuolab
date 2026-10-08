/* The SEO fields of a page (the `pages` columns), as an editor sends them. Empty text means "use the default" and is stored as NULL. */
import { z } from "zod";
import { externalHrefOk, internalHrefOk } from "../validation/navigation.ts";

const plain = (v: string) => !/[<>]/.test(v);

export const pageSeoSchema = z.strictObject({
  /** The title in search results and link previews. Empty: the default for the page (Settings > SEO). */
  seoTitle: z.string().trim().max(70, "Title is too long (max 70 characters)").refine(plain, "Title cannot contain < or >"),
  /** Empty, or 20 to 200 characters. */
  seoDescription: z.string().trim().max(200, "Description is too long (max 200 characters)").refine((v) => v === "" || v.length >= 20, "Description is too short (at least 20 characters, or leave it empty)").refine(plain, "Description cannot contain < or >"),
  /** A media id, or empty (the page's own picture, then the site default). */
  ogImageId: z.string().trim().max(80).regex(/^([A-Za-z0-9_-]+)?$/, "Not a media id"),
  /** Empty (the page's own address), a path on this site, or a full https:// address. */
  canonicalUrl: z.string().trim().max(300).refine((v) => v === "" || (v.startsWith("https://") ? externalHrefOk(v) : v.startsWith("/") && internalHrefOk(v)), "Canonical address must be a path like /about or a full https:// address"),
  /** Robots: index (false) or keep out of search results (true). */
  noindex: z.boolean(),
  /** Robots: follow the page's links (false) or not (true). */
  nofollow: z.boolean(),
});
export type PageSeoInput = z.infer<typeof pageSeoSchema>;
