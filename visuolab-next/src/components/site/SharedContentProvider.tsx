"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FooterExtrasSection } from "@/lib/cms/sections";

/**
 * The copy shared by every page that lives in the page CMS (the `shared` page): the closing call to action and the footer's extras, with the
 * pictures already turned into addresses. Nothing private is in here. Passed down from the layout, like the site settings and the menus.
 */
export type SharedContent = {
  /** Whether the closing call to action is switched on. */
  ctaEnabled: boolean;
  cta: {
    title: string;
    lead: string;
    primary: { label: string; href: string };
    avatars: { src: string; alt: string }[];
    floaters: { src: string; alt: string }[];
  };
  footer: FooterExtrasSection;
};

const Ctx = createContext<SharedContent | null>(null);

/** The shared copy. The layout always provides it (the built-in copy if the database cannot be read), so a missing provider is a programming error. */
export function useSharedContent(): SharedContent {
  const v = useContext(Ctx);
  if (!v) throw new Error("SharedContentProvider is missing");
  return v;
}

export default function SharedContentProvider({ value, children }: { value: SharedContent; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
