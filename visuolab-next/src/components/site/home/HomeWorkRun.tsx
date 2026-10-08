import Link from "@/components/site/ui/Link";
import { st } from "@/lib/css";
import CaseStack from "@/components/motion/CaseStack";
import CasePanel from "@/components/site/case/CasePanel";
import Rich from "@/components/site/ui/Rich";
import type { CaseShowcaseSection, IndustriesGridSection, ProcessStepsSection } from "@/lib/cms/sections";
import type { CaseCardSeed } from "@/content/types";

/** The drawing in each industry card: part of the design, bound to the card's position (not content). */
const INDUSTRY_ICONS = [
  <><circle cx="60" cy="60" r="14" /><circle cx="60" cy="60" r="26" /><circle cx="60" cy="60" r="38" /><circle cx="60" cy="60" r="50" /><circle cx="60" cy="60" r="4" fill="currentColor" stroke="none" /></>,
  <><circle cx="44" cy="60" r="34" /><circle cx="76" cy="60" r="34" /><path d="M60 30v60M54 36v48M66 36v48M48 44v32M72 44v32" /></>,
  <><ellipse cx="60" cy="60" rx="50" ry="20" /><ellipse cx="60" cy="60" rx="50" ry="20" transform="rotate(60 60 60)" /><ellipse cx="60" cy="60" rx="50" ry="20" transform="rotate(-60 60 60)" /><circle cx="60" cy="60" r="5" fill="currentColor" stroke="none" /></>,
  <><circle cx="60" cy="60" r="48" /><ellipse cx="60" cy="60" rx="20" ry="48" /><ellipse cx="60" cy="60" rx="36" ry="48" /><path d="M12 60h96M20 38h80M20 82h80" /></>,
];

type Props = {
  work: CaseShowcaseSection;
  /** The showcase cards of the chosen case studies, in order. */
  cards: readonly CaseCardSeed[];
  industries: IndustriesGridSection | null;
  process: ProcessStepsSection | null;
};

/** The second blue run of the home page: cases, industries and process. The words come from the page CMS; the case panels from the case studies. */
export default function HomeWorkRun({ work, cards, industries, process }: Props) {
  return (
    <>
      <div className="blue-run blue-run-2"><section className="sec seam-top" id="work"><div className="wrap"><div className="sec-grid cases-head"><p className="label reveal">{work.label}</p><h2 className="h2 reveal"><Rich>{work.title}</Rich></h2></div><CaseStack>{cards.map((c) => <CasePanel item={c} key={c.href} />)}</CaseStack><div className="cases-foot"><Link href="/works" className="pill ghost">{`${work.allLabel} `}<span className="badge"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span></Link></div></div></section>{industries && <section className="sec industries" id="industries" aria-labelledby="industries-title"><div className="wrap"><div className="ind-head"><div className="sec-grid"><p className="label reveal">{industries.label}</p><h2 className="h2 reveal" id="industries-title" style={st({ "--i": "0" })}><Rich>{industries.title}</Rich></h2></div><p className="lead reveal" style={st({ "--i": "1" })}>{industries.lead}</p></div><div className="ind-grid">{industries.items.map((it, i) => <article className="ind-card reveal" style={st({ "--i": String(i) })} key={i}><div className="ind-ico" aria-hidden="true"><svg viewBox="0 0 120 120">{INDUSTRY_ICONS[i]}</svg></div><div className="ind-txt"><h3>{it.title}</h3><p>{it.text}</p></div></article>)}</div></div></section>}{process && <section className="sec process seam-bottom" id="process"><div className="wrap"><div className="cols"><div className="intro"><p className="label reveal">{process.label}</p><h2 className="h2 reveal" style={st({ "--i": "0", "marginTop": "18px" })}><Rich>{process.title}</Rich></h2><p className="lead reveal" style={st({ "--i": "1", "marginTop": "18px", "maxWidth": "40ch" })}>{process.lead}</p><ul className="facts reveal" style={st({ "--i": "2" })}>{process.facts.map((f, i) => <li key={i}>{f}</li>)}</ul><a href={process.cta.href} className="pill reveal" style={st({ "--i": "3" })}>{`${process.cta.label} `}<span className="badge"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span></a></div><ol className="steps">{process.steps.map((s, i) => <li className="step" key={i}><span className="node" aria-hidden="true"></span><div className="step-body"><p className="label">{s.label}</p><h3><Rich>{s.title}</Rich></h3><p>{s.text}</p><ul className="out">{s.outputs.map((o, k) => <li key={k}>{o}</li>)}<li className="when">{s.when}</li></ul></div></li>)}</ol></div></div></section>}</div>
    </>
  );
}
