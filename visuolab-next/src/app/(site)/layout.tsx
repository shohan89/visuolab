import type { Metadata, Viewport } from "next";
import SiteMotion from "@/components/motion/SiteMotion";
import Analytics from "@/components/site/Analytics";
import ShellFooter from "@/components/site/ShellFooter";
import NavigationProvider, { FALLBACK_NAVIGATION } from "@/components/site/NavigationProvider";
import SiteConfigProvider, { type PublicSite } from "@/components/site/SiteConfigProvider";
import StyleGate from "@/components/site/StyleGate";
import { FONT_PRELOAD } from "@/lib/fonts.generated";
import fontFaces from "@/styles/fonts.css?raw";

/**
 * Starts the reveal animation of what is already on the first screen as soon as the HTML has been parsed, like the original static site did.
 * Without this, those headings stay invisible until the scripts have downloaded and the page has hydrated (the reveal observer in
 * SiteMotion only starts then), which is the largest part of the time to the largest paint on pages whose main heading is a reveal.
 * It also sets body.loaded (the hero headline's own load-in, which SiteMotion sets after hydration) two frames after parsing, as the original
 * page did. It only adds the class the observer would add a moment later for the same elements (same visibility rule as the observer: 5% visible
 * inside the viewport minus 10% at the bottom); everything below the first screen is still revealed by the observer as you scroll.
 */
const EARLY_REVEAL = "(function(){var r=document.querySelectorAll('.reveal'),h=innerHeight,q=matchMedia('(prefers-reduced-motion: reduce)').matches;for(var i=0;i<r.length;i++){var b=r[i].getBoundingClientRect();if(q||(b.bottom>0&&b.top<h*0.9-b.height*0.05))r[i].classList.add('in')}requestAnimationFrame(function(){requestAnimationFrame(function(){document.body.classList.add('loaded')})})})()";
import Nav from "@/components/site/chrome/Nav";
import JsonLd from "@/components/site/JsonLd";
import { organizationNode } from "@/lib/seo/jsonld";
import { twitterHandle } from "@/lib/seo/metadata";
import { getNavigation } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { getSiteConfig } from "@/lib/server/site-config";
import { analyticsActive } from "@/lib/settings/schema";
import { getSiteUrl } from "@/lib/site";

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Every public page reads the site settings from D1 at request time (D1 is not reachable while the site is built).
export const dynamic = "force-dynamic";

/**
 * Head tags for every public page, from the site settings: the address base for canonical and Open Graph links, the default title
 * and description (pages with their own override them), the favicon, the site name and default share picture, and the robots rule
 * when indexing is switched off. Head tags only; nothing visible changes.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [siteUrl, c] = await Promise.all([getSiteUrl(), getSiteConfig()]);
  return {
    metadataBase: new URL(siteUrl),
    title: { default: c.seo.defaultTitle, template: "%s" }, // pages give their full title; no suffix is added
    description: c.seo.defaultDescription,
    applicationName: c.general.siteName,
    ...(c.general.faviconUrl ? { icons: { icon: [{ url: c.general.faviconUrl }] } } : {}),
    ...(c.seo.indexing ? {} : { robots: { index: false, follow: false } }),
    openGraph: { siteName: c.general.siteName, locale: "en_GB", ...(c.seo.ogImageUrl ? { images: [{ url: c.seo.ogImageUrl }] } : {}) },
    twitter: { card: c.seo.ogImageUrl ? "summary_large_image" : "summary", ...(twitterHandle(c.social.x) ? { site: twitterHandle(c.social.x) } : {}), ...(c.seo.ogImageUrl ? { images: [c.seo.ogImageUrl] } : {}) },
  };
}

/** The header and footer menus from D1. If they cannot be read the site still renders, with the menus it was built with. */
async function menus() {
  try {
    return await getNavigation(getDb());
  } catch (e) {
    console.error("navigation unavailable, using the built-in menus", e instanceof Error ? e.message : e);
    return FALLBACK_NAVIGATION;
  }
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [siteUrl, c, navigation] = await Promise.all([getSiteUrl(), getSiteConfig(), menus()]);
  // the few values the header and footer show; nothing private
  const site: PublicSite = {
    siteName: c.general.siteName,
    logoUrl: c.general.logoUrl,
    logoDarkUrl: c.general.logoDarkUrl,
    email: c.contact.email,
    instagram: c.social.instagram,
    linkedin: c.social.linkedin,
    x: c.social.x,
    dribbble: c.social.others.find((o) => /dribbble/i.test(o.label))?.url ?? "",
  };
  const analytics = analyticsActive(siteUrl, c.analytics) ? c.analytics : null;
  return (
    <html lang="en">
      <head>
        {/* The same three fonts as the original site (DM Sans, Instrument Serif, Inter Tight), served from this site: no third-party connection, and
            the @font-face rules are inline so the first paint does not wait for a stylesheet request. Same files and subsets Google served. */}
        {FONT_PRELOAD.map((f) => <link key={f} rel="preload" as="font" type="font/woff2" href={`/fonts/${f}`} crossOrigin="" />)}
        <style dangerouslySetInnerHTML={{ __html: fontFaces }} />
        <StyleGate />
        {/* Without JS nothing adds .in, so keep .reveal content visible */}
        <noscript>
          <style>{".reveal,.reveal-load{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <JsonLd nodes={[organizationNode(siteUrl, c)]} />
      </head>
      <body className="rhythm">
        <SiteConfigProvider value={site}>
          <NavigationProvider value={navigation}>
            <SiteMotion>
              <Nav />
              {children}
              <ShellFooter />
            </SiteMotion>
          </NavigationProvider>
          {/* production only: in development React logs a (harmless) class mismatch for every element the script reveals before hydration */}
          {import.meta.env.PROD && <script dangerouslySetInnerHTML={{ __html: EARLY_REVEAL }} />}
          {analytics && <Analytics ga4={analytics.ga4On ? analytics.ga4 : ""} gtm={analytics.gtmOn ? analytics.gtm : ""} pixel={analytics.pixelOn ? analytics.metaPixel : ""} />}
        </SiteConfigProvider>
      </body>
    </html>
  );
}
