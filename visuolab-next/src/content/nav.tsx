import type { ReactNode } from "react";
import { serviceCardData } from "./nav-data";

/* Navigation for the header components: the data in nav-data.ts plus the icon drawn for each mega-menu card.
   One source for the desktop mega menu and the mobile menu (the original built the mobile menu by scraping the desktop DOM). */
export { cta, contactEmail, footerGroups, mainLinks, promo, serviceGroups } from "./nav-data";
export type { NavLink } from "./nav-data";

const icons: Record<(typeof serviceCardData)[number]["icon"], ReactNode> = {
  branding: <svg viewBox="0 0 24 24"><path d="M12 3l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z" /></svg>,
  product: <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M9 21h6" /></svg>,
  web: <svg viewBox="0 0 24 24"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" /></svg>,
};

export const serviceCards: { href: string; title: string; desc: string; icon: ReactNode }[] = serviceCardData.map((c) => ({ href: c.href, title: c.title, desc: c.desc, icon: icons[c.icon] }));

/** The drawing for an icon name stored with a mega-menu card; an unknown name draws nothing. */
export const iconFor = (key: string): ReactNode => (key in icons ? icons[key as keyof typeof icons] : null);
