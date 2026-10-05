/*
 * Inline formatting for article text, without HTML.
 *
 *   **bold**   *italic*   `code`   [link text](https://example.com)   \* a backslash shows the next character literally
 *
 * The text is stored as typed and turned into a list of nodes at render time; the page components then build React elements from
 * those nodes. Nothing is ever inserted as HTML, so article text cannot inject markup or script. Pure functions (no framework,
 * no server-only), shared by the admin editor (preview and validation) and the public pages.
 */

export type Inline = { t: "text" | "strong" | "em" | "code"; v: string } | { t: "link"; v: string; href: string };

/** A link target a visitor may be sent to: a path on this site, an in-page anchor, a mail link or an https address. */
export const isSafeHref = (v: string): boolean => /^(\/(?!\/)[^\s<>"'`]*|#[^\s<>"'`]*|mailto:[^\s<>"'`]+|https:\/\/[^\s<>"'`]+)$/.test(v);

// a link is [text](address); the address may hold one level of (parentheses), so "javascript:alert(1)" is seen as a link and judged
const LINK = /^\[([^\]\n]{1,200})\]\(((?:[^\s()]|\([^\s()]*\)){1,500})\)/;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => { if (text) { out.push({ t: "text", v: text }); text = ""; } };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const c = src[i]!;
    if (c === "\\" && i + 1 < src.length && /[\*`\[\]()]/.test(src[i + 1]!)) { text += src[i + 1]; i += 2; continue; }
    let m: RegExpExecArray | null;
    if (c === "*" && (m = /^\*\*([^*\n]+?)\*\*/.exec(rest))) { flush(); out.push({ t: "strong", v: m[1]! }); i += m[0].length; continue; }
    if (c === "*" && (m = /^\*([^*\n]+?)\*/.exec(rest))) { flush(); out.push({ t: "em", v: m[1]! }); i += m[0].length; continue; }
    if (c === "`" && (m = /^`([^`\n]+?)`/.exec(rest))) { flush(); out.push({ t: "code", v: m[1]! }); i += m[0].length; continue; }
    if (c === "[" && (m = LINK.exec(rest))) {
      flush();
      // an unsafe target is shown as plain text: the words stay, the link goes
      out.push(isSafeHref(m[2]!) ? { t: "link", v: m[1]!, href: m[2]! } : { t: "text", v: m[1]! });
      i += m[0].length;
      continue;
    }
    text += c;
    i += 1;
  }
  flush();
  // neighbouring plain pieces (an unsafe link is shown as its words) become one piece of text
  return out.reduce<Inline[]>((acc, n) => {
    const last = acc[acc.length - 1];
    if (last && last.t === "text" && n.t === "text") last.v += n.v;
    else acc.push({ ...n });
    return acc;
  }, []);
}

/** Every link written in the text (also unsafe ones), for validation. */
export function linkTargets(src: string): string[] {
  const out: string[] = [];
  const re = /\[([^\]\n]{1,200})\]\(((?:[^\s()]|\([^\s()]*\)){1,500})\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[2]!);
  return out;
}

/** The text without formatting marks: for reading-time counts, excerpts and search. */
export const plainInline = (src: string): string => parseInline(src).map((n) => n.v).join("");
