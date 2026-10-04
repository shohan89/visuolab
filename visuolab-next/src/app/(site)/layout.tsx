import type { Viewport } from "next";
import SiteMotion from "@/components/motion/SiteMotion";
import StyleGate from "@/components/site/StyleGate";
import Nav from "@/components/site/chrome/Nav";

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Same font request as the original site: DM Sans, Instrument Serif, Inter Tight */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <StyleGate />
        {/* Without JS nothing adds .in, so keep .reveal content visible */}
        <noscript>
          <style>{".reveal,.reveal-load{opacity:1!important;transform:none!important}"}</style>
        </noscript>
      </head>
      <body className="rhythm">
        <SiteMotion>
          <Nav />
          {children}
        </SiteMotion>
      </body>
    </html>
  );
}
