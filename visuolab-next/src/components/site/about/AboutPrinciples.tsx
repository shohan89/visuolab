import { st } from "@/lib/css";
import Rich from "@/components/site/ui/Rich";
import type { PrinciplesListSection } from "@/lib/cms/sections";

/** Principles: a numbered list (the numbers are generated). The words come from the page CMS. */
export default function AboutPrinciples({ content }: { content: PrinciplesListSection }) {
  return (
    <>
      <section className="sec" id="principles" aria-labelledby="principles-title"><div className="wrap"><div className="principles"><div className="sec-grid">{content.label && <p className="label reveal">{content.label}</p>}<h2 className="h2 reveal" id="principles-title" style={st({ "--i": "0" })}><Rich>{content.title}</Rich></h2>{content.lead && <p className="lead reveal" style={st({ "--i": "1" })}>{content.lead}</p>}</div><div className="principle-list">{content.items.map((it, i) => <div className="principle reveal" style={st({ "--i": String(i) })} key={i}><span className="num">{String(i + 1).padStart(2, "0")}</span><div><h3>{it.title}</h3><p>{it.text}</p></div></div>)}</div></div></div></section>
    </>
  );
}
