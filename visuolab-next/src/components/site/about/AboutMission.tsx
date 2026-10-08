import { st } from "@/lib/css";
import type { MissionVisionSection } from "@/lib/cms/sections";

/** Mission and vision: two cards side by side. The words come from the page CMS. */
export default function AboutMission({ content }: { content: MissionVisionSection }) {
  return (
    <>
      <section className="sec" aria-label="Mission and vision"><div className="wrap"><div className="mv">{[content.mission, content.vision].map((c, i) => <div className="mv-card reveal" style={st({ "--i": String(i) })} key={i}>{c.tag && <span className="tag">{c.tag}</span>}<h3>{c.title}</h3><p>{c.text}</p></div>)}</div></div></section>
    </>
  );
}
