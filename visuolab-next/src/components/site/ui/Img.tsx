import type { ImgHTMLAttributes } from "react";
import { defaultSizes, responsive } from "@/lib/images";

/**
 * <img> with responsive srcset/sizes added and lazy images decoded off the main thread. Everything else is passed through unchanged, so
 * the markup, classes, alt text and layout are exactly what the plain <img> was. Pass `sizes` when the picture's width is known.
 */
export default function Img({ sizes, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const set = typeof props.src === "string" && !props.srcSet ? responsive(props.src, sizes ?? defaultSizes(props.className)) : {};
  // the caller supplies alt (and the rest) in props, which are spread onto the element
  // eslint-disable-next-line jsx-a11y/alt-text
  return <img {...props} {...(props.loading === "lazy" && !props.decoding ? { decoding: "async" as const } : {})} {...set} />;
}
