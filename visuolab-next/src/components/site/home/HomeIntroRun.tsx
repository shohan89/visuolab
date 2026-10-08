import { st } from "@/lib/css";
import Reel from "@/components/motion/Reel";
import LogoMarquee from "@/components/site/ui/LogoMarquee";
import Rich from "@/components/site/ui/Rich";
import type { LogoSeed } from "@/content/logos";
import type { LogoMarqueeSection, WhyStatsSection } from "@/lib/cms/sections";

type Props = {
  /** The "Trusted by" band; null when the section is switched off. */
  logos: { content: LogoMarqueeSection; items: readonly LogoSeed[] } | null;
  /** The showreel; null when the section is switched off. */
  showreel: { videoSrc: string; posterSrc: string; tag: string; time: string } | null;
  why: WhyStatsSection;
};

/** The first blue run of the home page: trusted-by band, showreel, "why us" and the numbers. The words and files come from the page CMS. */
export default function HomeIntroRun({ logos, showreel, why }: Props) {
  return (
    <>
      <div className="blue-run">{logos && <section className="intro-band"><div className="wrap"><div className="logos">{logos.content.label && <p className="label">{logos.content.label}</p>}<LogoMarquee items={logos.items} /></div></div></section>}{showreel && <section className="showreel" id="showreel" aria-label="Showreel"><div className="wrap"><Reel style={st({ "--p": "0" })}><div className="reel-media" aria-hidden="true"><video className="reel-video" playsInline muted loop preload="none" poster={showreel.posterSrc}><source src={showreel.videoSrc} type="video/mp4" /></video></div><div className="reel-ui"><span className="reel-tag"><i></i>{showreel.tag}</span><span className="reel-time">{showreel.time}</span></div></Reel></div></section>}<section className="sec why seam-bottom" id="why"><div className="wrap"><div className="sec-grid"><p className="label reveal">{why.label}</p><div className="why-body"><h2 className="h2 reveal" style={st({ "--i": "0" })}><Rich>{why.title}</Rich></h2><ul className="why-list reveal" style={st({ "--i": "1" })}>{why.items.map((item, i) => <li key={i}><a href={item.href}>{`${item.label} `}<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></a></li>)}</ul></div></div><div className="stats reveal-group">{why.stats.map((s, i) => <div className="stat reveal" style={st({ "--i": String(i) })} key={i}><b><Rich>{s.value}</Rich></b><span>{s.label}</span></div>)}</div></div></section></div>
    </>
  );
}
