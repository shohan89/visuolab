import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Original static site used .html URLs; keep them working.
  // The admin area is never cached, never framed, and sends no referrer.
  async headers() {
    return [
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
