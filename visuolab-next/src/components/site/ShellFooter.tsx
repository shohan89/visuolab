"use client";

import { usePathname } from "next/navigation";
import CtaBand from "@/components/site/chrome/CtaBand";
import Footer, { type FooterVariant } from "@/components/site/chrome/Footer";
import { useSharedContent } from "@/components/site/SharedContentProvider";

/**
 * Bottom of every page: the closing CTA band and the footer.
 * The original omitted the CTA band on the contact page, and its footer links differ per page
 * (own-page links point at anchors), so both follow the route.
 */
export default function ShellFooter() {
  const { ctaEnabled } = useSharedContent();
  const path = usePathname().replace(/\/+$/, "") || "/";
  const variant: FooterVariant = path === "/" ? "home" : path === "/about" ? "about" : path === "/works" ? "works" : path === "/contact" ? "contact" : "default";
  return (
    <>
      {path !== "/contact" && ctaEnabled && <CtaBand />}
      <Footer variant={variant} />
    </>
  );
}
