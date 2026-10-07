"use client";

import Link from "@/components/site/ui/Link";
import { useEffect, useRef, useState } from "react";
import { iconFor } from "@/content/nav";
import { newTabProps, useNavigation } from "@/components/site/NavigationProvider";
import { subscribeScroll } from "@/lib/motion/scroll";
import Pill from "@/components/site/ui/Pill";
import Brand from "./Brand";
import MobileNav from "./MobileNav";

/** Header: solid after 24px of scroll, dark text while it sits over a light section (.scrolled / .over-light). */
export default function Nav() {
  const { primary, cta, megaCards, promo, megaColumns } = useNavigation();
  const ref = useRef<HTMLElement>(null);
  const burger = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [overLight, setOverLight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    return subscribeScroll(() => {
      const nav = ref.current;
      if (!nav) return;
      const navH = nav.offsetHeight;
      setScrolled(window.scrollY > 24);
      const lights = Array.from(document.querySelectorAll<HTMLElement>(".light"));
      setOverLight(
        lights.some((s) => {
          const r = s.getBoundingClientRect();
          const off = parseFloat(s.dataset.lightOffset || "0"); // px of the section that are still dark/blue
          return r.top + off <= navH * 0.6 && r.bottom >= navH * 0.6;
        }),
      );
    });
  }, []);

  return (
    <header className={"nav" + (scrolled ? " scrolled" : "") + (overLight ? " over-light" : "")} id="nav" ref={ref}>
      <div className="wrap">
        <Brand />
        <nav className="nav-links" aria-label="Primary">
          <div className="nav-item">
            <button type="button" data-menu aria-haspopup="true">
              Services <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div className="menu mega">
              <div className="mega-main">
                <p className="mega-label">Core departments</p>
                <div className="mega-cards">
                  {megaCards.map((c) => (
                    <Link className="mega-card" href={c.href} key={`${c.href}|${c.label}`} {...newTabProps(c)}>
                      <span className="ico">{iconFor(c.icon)}</span>
                      <b>{c.label}</b>
                      <span className="d">{c.description}</span>
                    </Link>
                  ))}
                </div>
                {promo && (
                  <Link className="mega-promo" href={promo.href} {...newTabProps(promo)}>
                    <b>{promo.label} <span className="tag">{promo.tag}</span></b>
                    <span>{promo.description}</span>
                    <svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg>
                  </Link>
                )}
              </div>
              <div className="mega-side">
                {megaColumns.map((g, gi) => (
                  <div className="mega-col" key={`${gi}|${g.label}`}>
                    <p className="mega-label">{g.label}</p>
                    <ul>
                      {g.links.map((l, li) => (
                        <li key={`${li}|${l.label}`}><Link href={l.href} {...newTabProps(l)}>{l.label}</Link></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {primary.map((l) => (
            <Link href={l.href} key={`${l.href}|${l.label}`} {...newTabProps(l)}>{l.label}</Link>
          ))}
        </nav>
        {cta && <Pill className="nav-cta" href={cta.href} newTab={cta.newTab}>{cta.label}</Pill>}
        <button
          className="nav-burger"
          aria-label="Menu"
          aria-controls="mnav"
          aria-expanded={menuOpen}
          ref={burger}
          onClick={() => setMenuOpen(true)}
        >
          <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} returnFocusTo={burger} />
    </header>
  );
}
