/*
 * Which menus the Navigation screen edits, and the limits of each. Plain data with no imports, so the editor (browser), the server
 * action and the checks share one description.
 */

export type MenuName = "primary" | "cta" | "mega_cards" | "mega_promo" | "mega_columns" | "footer";
export type SectionKey = "header" | "footer";
export type ItemType = "internal" | "external" | "group";

export type MenuConfig = {
  menu: MenuName;
  title: string;
  hint: string;
  /** Items are headings (groups) that hold links, instead of links directly. */
  grouped: boolean;
  /** Most top-level items (groups when grouped). */
  max: number;
  /** Most links in one group. */
  maxChildren?: number;
  /** Shows the one-line description, small badge and icon fields (the cards and the promo of the Services dropdown). */
  extras?: { description: boolean; tag: boolean; icon: boolean };
  noun: string;
};

export const SECTIONS: Record<SectionKey, { title: string; menus: MenuConfig[] }> = {
  header: {
    title: "Header navigation",
    menus: [
      { menu: "primary", title: "Primary links", hint: "The links next to the Services menu at the top of every page.", grouped: false, max: 8, noun: "link" },
      { menu: "cta", title: "Contact button", hint: "The highlighted button at the right of the header, also shown in the mobile menu.", grouped: false, max: 1, noun: "button" },
      { menu: "mega_columns", title: "Services dropdown: columns", hint: "The link columns in the Services dropdown and in the mobile menu. A column is a heading with links under it.", grouped: true, max: 6, maxChildren: 10, noun: "column" },
      { menu: "mega_cards", title: "Services dropdown: cards", hint: "The large cards at the top of the Services dropdown.", grouped: false, max: 6, extras: { description: true, tag: false, icon: true }, noun: "card" },
      { menu: "mega_promo", title: "Services dropdown: promo", hint: "The highlighted line under the cards (also in the mobile menu).", grouped: false, max: 1, extras: { description: true, tag: true, icon: false }, noun: "promo" },
    ],
  },
  footer: {
    title: "Footer navigation",
    menus: [
      { menu: "footer", title: "Footer columns", hint: "The link columns in the footer. A column is a heading with links under it.", grouped: true, max: 6, maxChildren: 12, noun: "column" },
    ],
  },
};

export const ICON_KEYS = ["branding", "product", "web"] as const;
export const LIMITS = { label: 60, href: 300, description: 160, tag: 30, id: 64 } as const;
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** The pages of the website that are not in the database: offered when picking an internal link. */
export const STATIC_PAGES: { href: string; label: string; ref: string }[] = [
  { href: "/", label: "Home", ref: "page:home" },
  { href: "/works", label: "Works", ref: "page:works" },
  { href: "/blog", label: "Blog", ref: "page:blog" },
  { href: "/about", label: "About", ref: "page:about" },
  { href: "/contact", label: "Contact", ref: "page:contact" },
  { href: "/services", label: "Services (overview)", ref: "page:services" },
];

/** One row as the editor and the action exchange it. Position is the order in the list (per menu and parent). */
export type NavItem = {
  id: string;
  menu: MenuName;
  parentId: string | null;
  type: ItemType;
  label: string;
  href: string;
  isVisible: boolean;
  openInNewTab: boolean;
  description: string;
  tag: string;
  icon: string;
};

export const menusOf = (section: SectionKey): MenuName[] => SECTIONS[section].menus.map((m) => m.menu);
