/*
 * Responsive pictures. A page asks for `responsive(src, sizes)` and gets the srcset/sizes attributes for it, so a phone downloads a
 * small copy and a large screen a large one; the browser picks from `sizes` and the screen's pixel density.
 *   - Pictures shipped with the site (/assets/…) have pre-made smaller copies (scripts/perf/make-image-variants.mjs).
 *   - Uploaded pictures (/media/…) get Cloudflare-resized copies when IMAGE_TRANSFORMS is on; otherwise they are used as they are.
 * The original stays the `src`, so anything that ignores srcset (old browsers, feeds, no-script) still shows the same picture.
 */
import { IMAGE_VARIANTS } from "./image-variants.generated.ts";
import { MEDIA_PREFIX, publicMediaUrl, transformUrl } from "./media/url.ts";

const WIDTHS = [320, 480, 640, 800, 1024, 1280, 1600];

export function responsive(src: string, sizes: string): { srcSet?: string; sizes?: string } {
  const variants = IMAGE_VARIANTS[src];
  if (variants && variants.length > 1) return { srcSet: variants.map(([w, u]) => `${u} ${w}w`).join(", "), sizes };
  if (src.startsWith(MEDIA_PREFIX)) {
    const transformed = transformUrl(src, { width: WIDTHS[0] });
    if (transformed !== publicMediaUrl(src)) return { srcSet: WIDTHS.map((w) => `${transformUrl(src, { width: w })} ${w}w`).join(", "), sizes };
  }
  return {};
}

/** `sizes` when the caller gives none: small round pictures (avatars) are tiny, everything else is a card or a wide image. */
export const defaultSizes = (className?: string): string => (className && /\bavatar\b/.test(className) ? "52px" : "(max-width: 900px) 100vw, 760px");
