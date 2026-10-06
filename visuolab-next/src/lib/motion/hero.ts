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
  const written = new Map<string, number>(); // what each custom property was last set to

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

    // A custom property written on .banner is inherited by everything in the hero, so every write makes the browser recompute the style of the
    // whole subtree. Values that have not moved (the scroll has stopped, the pointer is still, the pulse has died away) are therefore not
    // written again, and a change smaller than `eps` (far below what the eye can see: a thousandth of the range, a few hundredths of a pixel) waits
    // for the next frame that moves further. The motion itself is unchanged.
    const put = (name: string, value: number, eps: number, unit = "") => {
      const prev = written.get(name);
      if (prev !== undefined && Math.abs(prev - value) < eps) return;
      written.set(name, value);
      el.style.setProperty(name, String(value) + unit);
    };
    put("--reach", reduce ? 0 : reach, 0.0005);
    put("--pulse", reduce ? 0 : pulse, 0.0005);
    put("--ripple", reduce ? 0 : ripple, 0.0005);
    put("--ripple-opacity", reduce || contact < 0 || contact >= 1.8 ? 0 : (1 - ripple) * 0.8, 0.0005);
    put("--mx", reduce ? 0 : x, 0.0005);
    put("--my", reduce ? 0 : y, 0.0005);
    put("--float", reduce ? 0 : Math.sin(now / 2300) * 6, 0.03, "px");
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
