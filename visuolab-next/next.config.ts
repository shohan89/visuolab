import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Original static site used .html URLs; keep them working.
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
