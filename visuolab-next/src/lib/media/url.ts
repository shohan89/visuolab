/*
 * Where a picture is loaded from.
 *
 *   media.url        what the database stores: a path. Uploaded files are "/media/<object key>"; files shipped with the site are "/assets/…".
 *   publicMediaUrl() what a page puts in <img src>: an uploaded file's address on the media domain (MEDIA_BASE_URL) when one is
 *                    configured, otherwise the same path on the site (served from R2 by the Worker).
 *   transformUrl()   an optional Cloudflare Image Resizing address (/cdn-cgi/image/…) for a smaller or modern-format copy.
 *
 * Pure, no framework: the Worker sets the base once per request (see getDb), and the verification script tests it directly.
 */

let base = "";
let transforms = false;

/** Configure from the Worker environment. `mediaBase` is an origin like https://media.example.com (a trailing slash is ignored). */
export function configureMedia(mediaBase: string | undefined, imageTransforms?: string | undefined): void {
  const b = (mediaBase ?? "").trim().replace(/\/+$/, "");
  base = /^https:\/\/[^\s/]+$/.test(b) ? b : "";
  transforms = imageTransforms === "1" || imageTransforms === "true";
}

export const MEDIA_PREFIX = "/media/";

/** The address a visitor's browser should use for a stored media path. Paths that are not uploads (shipped /assets files) are unchanged. */
export function publicMediaUrl(stored: string): string {
  return base && stored.startsWith(MEDIA_PREFIX) ? `${base}/${stored.slice(MEDIA_PREFIX.length)}` : stored;
}

/**
 * A resized copy through Cloudflare Image Resizing, when it is switched on (IMAGE_TRANSFORMS=1; it needs the site on a Cloudflare zone
 * with Image Transformations enabled). Otherwise the original. `src` is the stored path or a full address.
 */
export function transformUrl(src: string, opts: { width?: number; quality?: number; format?: "auto" | "webp" | "avif" } = {}): string {
  const url = publicMediaUrl(src);
  if (!transforms) return url;
  const o = [opts.width ? `width=${Math.round(opts.width)}` : "", `quality=${opts.quality ?? 82}`, `format=${opts.format ?? "auto"}`, "fit=scale-down"].filter(Boolean).join(",");
  return `/cdn-cgi/image/${o}/${url.replace(/^\//, "")}`;
}
