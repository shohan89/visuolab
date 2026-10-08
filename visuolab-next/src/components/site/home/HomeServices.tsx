import { st } from "@/lib/css";
import Img from "@/components/site/ui/Img";
import Rich from "@/components/site/ui/Rich";
import type { ServicesColumnsSection } from "@/lib/cms/sections";

/** The drawing beside each column's title: part of the design, bound to the column's position (not content). */
const columnIcon = (i: number) =>
  i === 0 ? <path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.4l-5.3 2.8 1.1-5.9L3.5 9.2l5.9-.8z" />
  : i === 1 ? <><rect x="3" y="4" width={18} height={14} rx="2" /><path d="M3 9h18M8 21h8M12 18v3" /></>
  : <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" />;

/** The first words of the heading, up to its emphasised phrase, stay on one line (`.keep`). */
function Heading({ children }: { children: string }) {
  const at = children.indexOf("<em>");
  if (at <= 0) return <Rich>{children}</Rich>;
  return (
    <>
      <span className="keep">{children.slice(0, at).trimEnd()}</span>{" "}
      <Rich>{children.slice(at)}</Rich>
    </>
  );
}

/** The Services section of the home page. The words, links and the photo come from the page CMS; the drawings are fixed. */
export default function HomeServices({ content, avatarSrc }: { content: ServicesColumnsSection; avatarSrc: string }) {
  const bar = content.bookBar;
  return (
    <>
      <section className="sec light services seam-top seam-bottom" id="services" data-light-offset="320"><div className="wrap"><div className="sec-grid"><p className="label reveal">{content.label}</p><div className="services-head"><h2 className="h2 reveal" style={st({ "--i": "0" })}><Heading>{content.title}</Heading></h2><p className="lead reveal" style={st({ "--i": "1" })}>{content.lead}</p></div></div><div className="svc-cols reveal-group">{content.columns.map((col, i) => <div className="svc reveal" style={st({ "--i": String(i) })} key={i}><div className="svc-top"><h3>{col.title}</h3><div className="svc-ico"><span><svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></span><span className="fill"><svg viewBox="0 0 24 24">{columnIcon(i)}</svg></span></div></div><ul>{col.links.map((l, k) => <li key={k}><a href={l.href}>{`${l.label} `}<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7v10H7" /></svg></a></li>)}</ul></div>)}</div><div className="book-bar reveal"><div className="who">{bar.avatar && <Img className="avatar" src={avatarSrc} alt={bar.avatar.alt} />}<div><b>{bar.name}</b><span>{bar.role}</span></div></div><p>{bar.text}</p><a href={bar.cta.href} className="pill dark">{`${bar.cta.label} `}<span className="badge"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span></a></div></div></section>
    </>
  );
}
