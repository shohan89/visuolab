import { jsonLdScript } from "@/lib/seo/jsonld";

/** Structured data for a page: one script tag, serialised so editor text can never close it. Not visible. */
export default function JsonLd({ nodes }: { nodes: Record<string, unknown>[] }) {
  if (nodes.length === 0) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(nodes) }} />;
}
