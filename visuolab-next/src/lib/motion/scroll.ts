/*
 * Shared scroll driver (port of `onScroll` in js/main.js).
 * One rAF-throttled tick fans out to every subscriber, so nav state, case stack,
 * showreel and manifesto all read layout once per frame, exactly like the original.
 */
type Fn = () => void;

const subscribers = new Set<Fn>();
let ticking = false;

export function requestScrollUpdate(): void {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    subscribers.forEach((fn) => fn());
    ticking = false;
  });
}

/** Subscribe to the shared tick. Runs once on the next frame, like the original initial `onScroll()`. */
export function subscribeScroll(fn: Fn): () => void {
  subscribers.add(fn);
  requestScrollUpdate();
  return () => {
    subscribers.delete(fn);
  };
}

/** Attach the native listeners that feed the driver. Returns the cleanup. */
export function startScrollDriver(): () => void {
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);
  requestScrollUpdate();
  return () => {
    window.removeEventListener("scroll", requestScrollUpdate);
    window.removeEventListener("resize", requestScrollUpdate);
  };
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
