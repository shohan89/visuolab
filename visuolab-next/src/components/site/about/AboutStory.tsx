import { st } from "@/lib/css";
import Rich from "@/components/site/ui/Rich";
import type { TimelineSection } from "@/lib/cms/sections";

/** The story timeline: five milestones. The words come from the page CMS. */
export default function AboutStory({ content }: { content: TimelineSection }) {
  return (
    <>
      <section className="sec story has-aurora glow-right" id="story" aria-labelledby="story-title"><div className="aurora" aria-hidden="true"><span className="s1"></span><span className="s2"></span></div><div className="wrap"><div className="story-head sec-grid">{content.label && <p className="label reveal">{content.label}</p>}<h2 className="h2 reveal" id="story-title" style={st({ "--i": "0" })}><Rich>{content.title}</Rich></h2></div><ol className="timeline reveal-group">{content.items.map((m, i) => <li className="milestone reveal" style={st({ "--i": String(i) })} key={i}><span className="year">{m.year}</span><h3>{m.title}</h3><p>{m.text}</p></li>)}</ol></div></section>
    </>
  );
}
