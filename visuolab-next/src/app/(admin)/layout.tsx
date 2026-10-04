import type { Metadata, Viewport } from "next";
import "@/styles/admin.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** The admin area is never indexed and never cached. It has its own root layout and none of the public site's styles. */
export const metadata: Metadata = {
  title: "Admin — Visuolab",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="admin">{children}</body>
    </html>
  );
}
