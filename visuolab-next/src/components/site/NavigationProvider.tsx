"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cta, footerGroups, mainLinks, promo, serviceCardData, serviceGroups } from "@/content/nav-data";
import type { Navigation } from "@/lib/server/cms";

/**
 * The menus the header and footer draw, passed down from the layout (which reads them from D1). Only public text and addresses.
 * The default is the content the site was seeded with: it is what shows if the database cannot be read, and in tests of single components.
 */
export const FALLBACK_NAVIGATION: Navigation = {
  primary: mainLinks,
  cta,
  megaCards: serviceCardData.map((c) => ({ label: c.title, href: c.href, description: c.desc, icon: c.icon })),
  promo: { label: promo.title, href: promo.href, description: promo.desc, tag: promo.tag },
  megaColumns: serviceGroups,
  footer: footerGroups,
};

const Ctx = createContext<Navigation>(FALLBACK_NAVIGATION);

export const useNavigation = () => useContext(Ctx);

export default function NavigationProvider({ value, children }: { value: Navigation; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Extra attributes for a link set to open in a new tab; nothing for the others, so their markup stays as it was. */
export const newTabProps = (l: { newTab?: boolean }) => (l.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {});
