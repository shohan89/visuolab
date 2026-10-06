"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The few settings the header and footer need, passed down from the layout (which reads them from D1). Nothing private is in here:
 * only what is already visible on the page (names, logo addresses, public contact address, public profile links).
 */
export type PublicSite = {
  siteName: string;
  logoUrl: string;
  logoDarkUrl: string;
  email: string;
  instagram: string;
  linkedin: string;
  x: string;
  dribbble: string;
};

/** The values the website had before settings existed, used until the provider supplies real ones (and in tests of single components). */
export const FALLBACK_SITE: PublicSite = { siteName: "Visuolab", logoUrl: "/assets/logo.png", logoDarkUrl: "/assets/logo-dark.png", email: "hello@visuolab.studio", instagram: "", linkedin: "", x: "", dribbble: "" };

const Ctx = createContext<PublicSite>(FALLBACK_SITE);

export const useSiteConfig = () => useContext(Ctx);

export default function SiteConfigProvider({ value, children }: { value: PublicSite; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Attributes for a link to an outside profile: opens safely in a new tab when it is a real address; the old "#" placeholder stays as it was. */
export const profileLink = (url: string) => (url ? { href: url, target: "_blank", rel: "noopener noreferrer" } : { href: "#" });
