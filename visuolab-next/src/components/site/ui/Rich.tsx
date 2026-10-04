import { Fragment, type ReactNode } from "react";

/** Renders seed text that may contain <em>…</em> and <b>…</b>. No HTML is injected; anything else stays plain text. */
export default function Rich({ children }: { children: string }) {
  const out: ReactNode[] = [];
  children.split(/(<em>.*?<\/em>|<b>.*?<\/b>)/g).forEach((part, i) => {
    if (!part) return;
    const em = /^<em>(.*)<\/em>$/.exec(part);
    const b = /^<b>(.*)<\/b>$/.exec(part);
    out.push(em ? <em key={i}>{em[1]}</em> : b ? <b key={i}>{b[1]}</b> : <Fragment key={i}>{part}</Fragment>);
  });
  return <>{out}</>;
}
