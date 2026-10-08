import { Fragment, type ReactNode } from "react";

/**
 * Renders text that may contain <em>…</em> and <b>…</b>. No HTML is injected; anything else stays plain text.
 * `glue`: an emphasised phrase followed by punctuation keeps it on the same line (the hero headline's `<span class="nb"><em>brand</em>,</span>`).
 */
export default function Rich({ children, glue = false }: { children: string; glue?: boolean }) {
  const out: ReactNode[] = [];
  const parts = children.split(/(<em>.*?<\/em>|<b>.*?<\/b>)/g);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (!part) continue;
    const em = /^<em>(.*)<\/em>$/.exec(part);
    const b = /^<b>(.*)<\/b>$/.exec(part);
    if (em && glue) {
      const punct = /^[,.;:!?]/.exec(parts[i + 1] ?? "")?.[0];
      if (punct) {
        out.push(<span className="nb" key={i}><em>{em[1]}</em>{punct}</span>);
        parts[i + 1] = parts[i + 1]!.slice(1);
        continue;
      }
    }
    out.push(em ? <em key={i}>{em[1]}</em> : b ? <b key={i}>{b[1]}</b> : <Fragment key={i}>{part}</Fragment>);
  }
  return <>{out}</>;
}

/** The same text as plain strings and <em> / <b> elements in a list, for components that walk their children (the scroll-lit manifesto). */
export function richNodes(text: string): ReactNode[] {
  return text.split(/(<em>.*?<\/em>|<b>.*?<\/b>)/g).filter(Boolean).map((part, i) => {
    const em = /^<em>(.*)<\/em>$/.exec(part);
    const b = /^<b>(.*)<\/b>$/.exec(part);
    return em ? <em key={i}>{em[1]}</em> : b ? <b key={i}>{b[1]}</b> : part;
  });
}

/** Rich text where a newline is a forced line break (`<br />`). */
export function RichLines({ children }: { children: string }) {
  const lines = children.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          <Rich>{line}</Rich>
          {i < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}
