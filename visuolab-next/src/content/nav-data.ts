/* Navigation as plain data (no JSX), so the same values can be compared with the database seed.
   src/content/nav.tsx adds the drawn icons and is what the header components import. */

export type NavLink = { href: string; label: string };

export const serviceCardData = [
  { href: "/services/brand-identity", title: "Branding", desc: "Strategy, naming and the system that carries them", icon: "branding" },
  { href: "/services/product-design", title: "Product design", desc: "UX and UI built around product and business goals", icon: "product" },
  { href: "/services/web-design-build", title: "Web & motion", desc: "Sites, builds and motion that explain the product", icon: "web" },
] as const;

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

/** The footer columns. The database is the source the website reads; these are the values it was seeded with and what the footer shows if the database cannot be read. */
export const footerGroups: { label: string; links: NavLink[] }[] = [
  {
    label: "Services",
    links: [
      { href: "/services/brand-identity", label: "Brand identity" },
      { href: "/services/product-design", label: "Product design" },
      { href: "/services/web-design-build", label: "Web design" },
      { href: "/services/web-design-build", label: "Webflow development" },
      { href: "/services/motion-3d", label: "Motion design" },
    ],
  },
  { label: "Industries", links: ["SaaS", "Fintech", "Consumer", "Healthcare", "Web3"].map((label) => ({ href: "#", label })) },
  {
    label: "Company",
    links: [
      { href: "/works", label: "Works" },
      { href: "/#process", label: "Process" },
      { href: "/#reviews", label: "Reviews" },
      { href: "/about", label: "About" },
      { href: "/about#careers", label: "Careers" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export const cta: NavLink = { href: "/contact", label: "Contact us" };
export const contactEmail = "hello@visuolab.studio";
