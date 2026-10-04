import type { Metadata } from "next";
import "../styles/base.css";
import "../styles/hero.css";
import "../styles/sections.css";
import "../styles/work.css";
import "../styles/pages.css";
import "../styles/about.css";

export const metadata: Metadata = {
  title: "Visuolab — Digital product design agency",
  description: "Visuolab is a design agency that unites brand, website and product into one story.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="rhythm">{children}</body>
    </html>
  );
}
