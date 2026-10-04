import type { ReactNode } from "react";

/* Navigation data: the single source for the desktop mega menu and the mobile menu
   (the original built the mobile menu by scraping the desktop DOM). */

export type NavLink = { href: string; label: string };

export const serviceCards: { href: string; title: string; desc: string; icon: ReactNode }[] = [
  {
    href: "/services/brand-identity", title: "Branding", desc: "Strategy, naming and the system that carries them",
    icon: <svg viewBox="0 0 24 24"><path d="M12 3l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z" /></svg>,
  },
  {
    href: "/services/product-design", title: "Product design", desc: "UX and UI built around product and business goals",
    icon: <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M9 21h6" /></svg>,
  },
  {
    href: "/services/web-design-build", title: "Web & motion", desc: "Sites, builds and motion that explain the product",
    icon: <svg viewBox="0 0 24 24"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" /></svg>,
  },
];

export const promo = { href: "/contact", title: "Design sprint", tag: "1–2 weeks", desc: "Turn an idea into a validated plan you can build" };

export const serviceGroups: { label: string; links: NavLink[] }[] = [
  {
    label: "Branding",
    links: ["Brand strategy", "Naming", "Visual identity", "Art direction", "Brand guidelines"].map((label) => ({ href: "/services/brand-identity", label })),
  },
  {
    label: "Product design",
    links: ["UX research", "UI design", "Mobile app design", "Design systems", "Prototyping"].map((label) => ({ href: "/services/product-design", label })),
  },
  {
    label: "Web & motion",
    links: [
      { href: "/services/web-design-build", label: "Web design" },
      { href: "/services/web-design-build", label: "Webflow development" },
      { href: "/services/web-design-build", label: "Next.js sites" },
      { href: "/services/motion-3d", label: "Motion design" },
      { href: "/services/motion-3d", label: "3D & illustration" },
    ],
  },
];

export const mainLinks: NavLink[] = [
  { href: "/works", label: "Works" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

export const cta: NavLink = { href: "/contact", label: "Contact us" };
export const contactEmail = "hello@visuolab.studio";
