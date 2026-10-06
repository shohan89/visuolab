"use client";

import Script from "next/script";
import { gtagSnippet, gtmSnippet, pixelSnippet } from "@/lib/settings/schema";

/**
 * Google Analytics 4, Google Tag Manager and Meta Pixel. The layout renders this only when analytics are switched on and the site runs
 * on a real https address. The scripts load after the page is interactive, so they never delay or change what is shown.
 * Each ID is checked against its fixed pattern again here before it reaches a script: nothing else can be placed in them.
 */
const GA = /^G-[A-Z0-9]{6,12}$/;
const GTM = /^GTM-[A-Z0-9]{4,10}$/;
const PIXEL = /^\d{8,20}$/;

export default function Analytics({ ga4, gtm, pixel }: { ga4: string; gtm: string; pixel: string }) {
  return (
    <>
      {GA.test(ga4) && (
        <>
          <Script id="ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="lazyOnload" />
          <Script id="ga4-init" strategy="lazyOnload">{gtagSnippet(ga4)}</Script>
        </>
      )}
      {GTM.test(gtm) && (
        <>
          <Script id="gtm-init" strategy="lazyOnload">{gtmSnippet(gtm)}</Script>
          <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${gtm}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="Google Tag Manager" /></noscript>
        </>
      )}
      {PIXEL.test(pixel) && (
        <>
          <Script id="meta-pixel" strategy="lazyOnload">{pixelSnippet(pixel)}</Script>
          <noscript><img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1`} /></noscript>
        </>
      )}
    </>
  );
}
