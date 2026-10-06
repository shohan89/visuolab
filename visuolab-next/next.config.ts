import type { NextConfig } from "next";

/**
 * Baseline security headers: no MIME sniffing, a short referrer, no framing by other sites, no powerful browser features, and a CSP that
 * limits only what cannot break the page (who may frame it, where forms post, plugins, <base>). Scripts and styles are not restricted: the
 * site loads fonts and optional analytics, and a script-src is only worth having with a per-request nonce.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" }, // ignored over http; over https the browser keeps using https
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // Original static site used .html URLs; keep them working.
  // The admin area is never cached, never framed, and sends no referrer.
  async headers() {
    return [
      // Every response gets the baseline headers. ("/" is listed on its own because "/:path*" does not match the home page.)
      { source: "/", headers: SECURITY_HEADERS },
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/about.html", destination: "/about", permanent: true },
      { source: "/works.html", destination: "/works", permanent: true },
      { source: "/blog.html", destination: "/blog", permanent: true },
      { source: "/contact.html", destination: "/contact", permanent: true },
      { source: "/work/:slug.html", destination: "/works/:slug", permanent: true },
      { source: "/service/:slug.html", destination: "/services/:slug", permanent: true },
      { source: "/blog/:slug.html", destination: "/blog/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
