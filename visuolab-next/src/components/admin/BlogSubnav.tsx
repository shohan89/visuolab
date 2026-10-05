import Link from "@/components/site/ui/Link";

/** Articles / Categories / Tags: the three screens of the blog admin. */
export default function BlogSubnav({ current }: { current: "articles" | "categories" | "tags" }) {
  const items = [
    { key: "articles", label: "Articles", href: "/admin/blog" },
    { key: "categories", label: "Categories", href: "/admin/blog/categories" },
    { key: "tags", label: "Tags", href: "/admin/blog/tags" },
  ] as const;
  return (
    <nav className="subnav" aria-label="Blog sections">
      {items.map((i) => <Link href={i.href} key={i.key} aria-current={current === i.key ? "page" : undefined}>{i.label}</Link>)}
    </nav>
  );
}
