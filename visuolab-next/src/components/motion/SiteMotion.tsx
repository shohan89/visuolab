"use client";

/*
 * Site-wide motion: smooth scroll (Lenis 1.1.18, same options as js/main.js),
 * anchor easing, hash arrival, hero copy load-in and scroll reveal.
 * Everything else that used to live in main.js is a component of its own.
 */
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { prefersReducedMotion, requestScrollUpdate, startScrollDriver } from "@/lib/motion/scroll";

/* The Lenis instance lives in a tiny external store so any component (e.g. the mobile menu) can pause it. */
let current: Lenis | null = null;
const listeners = new Set<() => void>();
const setCurrent = (l: Lenis | null) => { current = l; listeners.forEach((fn) => fn()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const useLenis = () => useSyncExternalStore(subscribe, () => current, () => null);

export default function SiteMotion({ children }: { children: ReactNode }) {
  const lenis = useLenis();
  const pathname = usePathname();

  /* smooth scroll + scroll driver + in-page anchors */
  useEffect(() => {
    const docEl = document.documentElement;
    const stopDriver = startScrollDriver();
    let instance: Lenis | null = null;
    let raf = 0;
    let onClick: ((e: MouseEvent) => void) | null = null;

    if (!prefersReducedMotion()) {
      const l = new Lenis({
        lerp: 0.075, wheelMultiplier: 0.8, smoothWheel: true,
        touchMultiplier: 1.6, gestureOrientation: "vertical", autoResize: true,
      });
      instance = l;
      docEl.classList.add("lenis-on");
      Object.assign(window, { lenis: l });
      const loop = (t: number) => { l.raf(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      // in-page anchors go through Lenis so they ease instead of jump
      onClick = (e: MouseEvent) => {
        const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
        if (!a || (a.getAttribute("href") ?? "").length < 2) return;
        let target: Element | null = null;
        try { target = document.querySelector(a.getAttribute("href") as string); } catch { return; }
        if (!target) return;
        e.preventDefault();
        l.scrollTo(target as HTMLElement, { offset: -60, duration: 1.4 });
      };
      document.addEventListener("click", onClick);
      l.on("scroll", requestScrollUpdate); // reveals/nav stay in sync with the smooth position
      setCurrent(l);
    }

    return () => {
      if (onClick) document.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
      instance?.destroy();
      docEl.classList.remove("lenis-on");
      setCurrent(null);
      stopDriver();
    };
  }, []);

  /* dev server only: vinext's dev runtime defines window.process for its client router and then removes it
     after the first client-side navigation, so the next navigation threw "process is not defined".
     Pinning the property (still writable, no longer deletable) keeps client navigation working in `vite dev`.
     Production builds do not use window.process. */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { process?: unknown };
    if (w.process && Object.getOwnPropertyDescriptor(window, "process")?.configurable !== false) {
      Object.defineProperty(window, "process", { value: w.process, writable: true, configurable: false, enumerable: true });
    }
  }, []);

  /* hero copy: staggered rise on load (body.loaded) */
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("loaded")));
    return () => cancelAnimationFrame(id);
  }, []);

  /* arriving with #anchor: glide, don't jump (also after client-side navigation) */
  useEffect(() => {
    if (!lenis || location.hash.length < 2) return;
    let target: Element | null = null;
    try { target = document.querySelector(location.hash); } catch { return; }
    if (!target) return;
    const id = requestAnimationFrame(() => lenis.scrollTo(target as HTMLElement, { offset: -60, duration: 1.2, immediate: false }));
    return () => cancelAnimationFrame(id);
  }, [lenis, pathname]);

  /* reveal on scroll: re-armed for every page */
  useEffect(() => {
    const reveals = document.querySelectorAll(".reveal");
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      reveals.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    reveals.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return <>{children}</>;
}
