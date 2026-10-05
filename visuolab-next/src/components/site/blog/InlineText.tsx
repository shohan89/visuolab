import { Fragment, type ReactNode } from "react";
import { parseInline } from "@/lib/content/inline";

/** Article text with **bold**, *italic*, `code` and [links](…) as React elements. Plain text comes out as plain text, identical to a string. */
export default function InlineText({ children }: { children: string }) {
  const nodes = parseInline(children);
  if (nodes.length === 1 && nodes[0]!.t === "text") return <>{nodes[0]!.v}</>;
  return (
    <>
      {nodes.map((n, i): ReactNode => {
        switch (n.t) {
          case "strong": return <strong key={i}>{n.v}</strong>;
          case "em": return <em key={i}>{n.v}</em>;
          case "code": return <code key={i}>{n.v}</code>;
          case "link": return <a key={i} href={n.href} {...(n.href.startsWith("https://") ? { rel: "noopener noreferrer" } : {})}>{n.v}</a>;
          default: return <Fragment key={i}>{n.v}</Fragment>;
        }
      })}
    </>
  );
}
