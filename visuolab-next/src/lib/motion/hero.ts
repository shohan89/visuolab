/*
 * Scroll-hands banner controller — port of js/hero.js (same maths, same constants).
 * Drives CSS custom properties on .banner.reaching:
 *   --reach 0->1 hands move inward until the fingertips touch
 *   --pulse 0->1->0 orb brightens/expands/turns on contact
 *   --ripple 0->1 contact ring expands (with --ripple-opacity)
 *   --mx/--my -1->1 pointer parallax, --float px idle drift
 * Reverse scrolling reverses the sequence. Honors prefers-reduced-motion.
 * The star field is now rendered by <Stars/>, so it is not generated here.
 */
export function initBanner(el: HTMLElement): () => void {
  const section = el.parentElement as HTMLElement;
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let x = 0, y = 0, tx = 0, ty = 0, raf = 0, previous = 0, progress = 0;

  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  };
  const reset = () => { tx = 0; ty = 0; };

  const frame = (now: number) => {
    const dt = Math.min(50, now - previous || 16);
    previous = now;
    const ease = 1 - Math.exp(-dt / 190);
    x += (tx - x) * ease;
    y += (ty - y) * ease;

    const reduce = preference.matches;
    const distance = Math.max(1, section.offsetHeight - window.innerHeight);
    const target = Math.max(0, Math.min(1, -section.getBoundingClientRect().top / distance));
    progress += (target - progress) * (1 - Math.exp(-dt / 95));

    // 0-3.2: approach · 3.2-5.6: contact, pulse and ring
    const cycle = progress * 5.6;
    const sm = (v: number) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
    const reach = sm(cycle / 3.2);
    const contact = cycle - 3.2;
    const pulse = contact >= 0 && contact < 2.4
      ? Math.exp(-contact * 1.7) * Math.sin(Math.min(contact / 0.55, 1) * Math.PI / 2) : 0;
    const ripple = contact >= 0 && contact < 1.8 ? contact / 1.8 : 0;

    const s = el.style;
    s.setProperty("--reach", String(reduce ? 0 : reach));
    s.setProperty("--pulse", String(reduce ? 0 : pulse));
    s.setProperty("--ripple", String(reduce ? 0 : ripple));
    s.setProperty("--ripple-opacity", String(reduce || contact < 0 || contact >= 1.8 ? 0 : (1 - ripple) * 0.8));
    s.setProperty("--mx", String(reduce ? 0 : x));
    s.setProperty("--my", String(reduce ? 0 : y));
    s.setProperty("--float", (reduce ? 0 : Math.sin(now / 2300) * 6) + "px");
    raf = requestAnimationFrame(frame);
  };

  const start = () => { if (!raf) { previous = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", reset);
  el.addEventListener("pointerup", reset);

  // Only run the frame loop while the section is near the viewport.
  let io: IntersectionObserver | null = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) start(); else stop(); }, { rootMargin: "25%" });
    io.observe(section);
  } else {
    start();
  }

  return () => {
    stop();
    io?.disconnect();
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerleave", reset);
    el.removeEventListener("pointerup", reset);
  };
}
