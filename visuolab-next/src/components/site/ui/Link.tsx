import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * Site-wide link. Same as next/link but with prefetching off: the production router otherwise prefetches the page behind
 * every visible link and, with it, browser preload hints for that page's images (the home hero alone is about 600 KB),
 * which show up as "preloaded but not used" warnings on every other page. The static site never prefetched either.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
