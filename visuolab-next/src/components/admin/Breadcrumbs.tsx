"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = { admin: "Dashboard", submissions: "Submissions", services: "Services", "case-studies": "Case studies", blog: "Blog", media: "Media", settings: "Settings", ga4: "Google Analytics 4", gtm: "Google Tag Manager", meta_pixel: "Meta Pixel", resend: "Email notifications", turnstile: "Cloudflare Turnstile", webhook: "Webhook", crm_webhook: "CRM webhook", slack: "Slack notifications", general: "General", social: "Social", seo: "SEO", analytics: "Analytics", integrations: "Integrations", categories: "Categories", tags: "Tags", new: "New", edit: "Edit", confirm: "Confirm" };

/** Trail built from the address: Dashboard / Submissions. Unknown segments are shown as they are. */
export default function Breadcrumbs() {
  const parts = (usePathname() ?? "/admin").split("/").filter(Boolean);
  const crumbs = parts
    .map((p, i) => ({ href: "/" + parts.slice(0, i + 1).join("/"), label: LABELS[p] ?? decodeURIComponent(p), id: /^(svc|case|post|media)_/.test(p) }))
    .filter((c) => !c.id); // a record id is not a page of its own
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((c, i) => (
          <li key={c.href}>
            {i === crumbs.length - 1 ? <span aria-current="page">{c.label}</span> : <Link href={c.href} prefetch={false}>{c.label}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
