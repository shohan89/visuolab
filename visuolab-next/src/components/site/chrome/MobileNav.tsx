"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import { contactEmail, cta, mainLinks, promo, serviceGroups } from "@/content/nav";
import { st } from "@/lib/css";
import { prefersReducedMotion } from "@/lib/motion/scroll";
import { useLenis } from "@/components/motion/SiteMotion";
import Brand from "./Brand";

/**
 * Mobile menu dialog (below 900px). Same markup, classes, 380ms close timing, focus trap,
 * Escape handling and Lenis pause as js/main.js — but built from the shared nav data and React state.
 */
export default function MobileNav({ open, onClose, returnFocusTo }: { open: boolean; onClose: () => void; returnFocusTo: RefObject<HTMLButtonElement | null> }) {
  const lenis = useLenis();
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false); // portal target exists only on the client
  const [visible, setVisible] = useState(false); // [hidden] attribute
  const [ready, setReady] = useState(false); // start state committed, so .is-open can transition in
  const [subOpen, setSubOpen] = useState(false);
  const shown = open && ready; // .is-open (drives the CSS transition)

  const close = useCallback((restore = true) => {
    restoreFocus.current = restore;
    onClose();
  }, [onClose]);

  /* open / close choreography: unhide, then (next frame) add .is-open; on close hide after the 380ms transition */
  useEffect(() => {
    if (open) {
      let b = 0;
      const a = requestAnimationFrame(() => {
        setVisible(true);
        b = requestAnimationFrame(() => setReady(true));
      });
      return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
    }
    const t = setTimeout(() => { setVisible(false); setReady(false); }, prefersReducedMotion() ? 0 : 380);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (shown) closeBtn.current?.focus();
  }, [shown]);

  /* page scroll lock + Lenis pause */
  useEffect(() => {
    if (!open) return;
    const returnTo = returnFocusTo.current;
    document.documentElement.classList.add("mnav-open");
    lenis?.stop();
    return () => {
      document.documentElement.classList.remove("mnav-open");
      lenis?.start();
      if (restoreFocus.current) returnTo?.focus();
      restoreFocus.current = true;
    };
  }, [open, lenis, returnFocusTo]);

  /* Escape, Tab trap, and closing when the desktop layout returns */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab" || !panel.current) return; // keep Tab inside the open menu
      const f = Array.from(panel.current.querySelectorAll<HTMLElement>("a, button")).filter((el) => el.offsetParent !== null);
      const first = f[0], last = f[f.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const mq = window.matchMedia("(min-width: 901px)");
    const onMq = (m: MediaQueryListEvent) => { if (m.matches) close(false); };
    mq.addEventListener("change", onMq);
    return () => { document.removeEventListener("keydown", onKey); mq.removeEventListener("change", onMq); };
  }, [open, close]);

  if (!mounted) return null;

  let i = 0;
  return createPortal(
    <div
      className={shown ? "mnav is-open" : "mnav"}
      id="mnav"
      hidden={!visible}
      data-lenis-prevent=""
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      ref={panel}
      onClick={(e) => { if ((e.target as Element).closest("a")) close(false); }} // following a link closes the menu behind it
    >
      <div className="mnav-top wrap">
        <Brand />
        <button className="mnav-close" type="button" aria-label="Close menu" ref={closeBtn} onClick={() => close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <nav className="mnav-body wrap" aria-label="Mobile">
        <button
          className="mnav-link mnav-toggle"
          type="button"
          aria-expanded={subOpen}
          aria-controls="mnav-svc"
          style={st({ "--i": i++ })}
          onClick={() => setSubOpen((v) => !v)}
        >
          Services<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div className="mnav-sub" id="mnav-svc" hidden={!subOpen}>
          {serviceGroups.map((g) => (
            <div className="mnav-group" key={g.label}>
              <p className="mnav-group-label">{g.label}</p>
              <ul>
                {g.links.map((l) => (
                  <li key={l.label}><Link href={l.href}>{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
          <Link className="mnav-promo" href={promo.href}>
            <b>{promo.title} <span className="tag">{promo.tag}</span></b>
            <span>{promo.desc}</span>
          </Link>
        </div>
        {mainLinks.map((l) => (
          <Link className="mnav-link" style={st({ "--i": i++ })} href={l.href} key={l.href}>{l.label}</Link>
        ))}
      </nav>
      <div className="mnav-foot wrap" style={st({ "--i": i })}>
        <Link className="pill mnav-cta" href={cta.href}>
          {cta.label}
          <span className="badge">
            <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </Link>
        <a className="mnav-mail" href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </div>
    </div>,
    document.body,
  );
}
