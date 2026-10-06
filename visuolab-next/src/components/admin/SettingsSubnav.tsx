import Link from "@/components/site/ui/Link";

export const SECTIONS = [
  { key: "general", label: "General" },
  { key: "contact", label: "Contact" },
  { key: "social", label: "Social" },
  { key: "seo", label: "SEO" },
  { key: "analytics", label: "Analytics" },
  { key: "integrations", label: "Integrations" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];

/** The six screens of the site settings. */
export default function SettingsSubnav({ current }: { current: SectionKey }) {
  return (
    <nav className="subnav" aria-label="Settings sections">
      {SECTIONS.map((s) => <Link href={`/admin/settings/${s.key}`} key={s.key} aria-current={current === s.key ? "page" : undefined}>{s.label}</Link>)}
    </nav>
  );
}
