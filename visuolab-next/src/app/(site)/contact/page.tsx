import type { Metadata } from "next";
import ContactSection from "@/components/site/contact/ContactSection";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Contact — Visuolab",
  description: "Tell us about your project. A real person answers within one working day — no forms into the void, no sales sequence.",
  path: "/contact",
});

export default function ContactRoute() {
  return <ContactSection />;
}
