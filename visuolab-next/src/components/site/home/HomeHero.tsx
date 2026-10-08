import { st } from "@/lib/css";
import HeroBanner from "@/components/motion/HeroBanner";
import MeshFlow from "@/components/motion/MeshFlow";
import Stars from "@/components/motion/Stars";
import Img from "@/components/site/ui/Img";
import Rich from "@/components/site/ui/Rich";
import type { HomeHeroSection } from "@/lib/cms/sections";

const SCENE_LABEL = "Two human hands reach toward each other in front of a glowing sphere. Scrolling brings the fingertips together.";

/** Hero: the words come from the page CMS; the scene (hands, orb, mesh, stars) is fixed art. */
export default function HomeHero({ content }: { content: HomeHeroSection }) {
  return (
    <>
      <section className="scroll-sequence" id="top" aria-label="Introduction"><HeroBanner className="banner reaching"><MeshFlow><span className="m1"></span><span className="m2"></span><span className="m3"></span><span className="m4"></span><span className="m5"></span></MeshFlow><Stars /><div className="stage"><div className="scene" role="img" aria-label={content.sceneLabel || SCENE_LABEL}><div className="orb-layer"><span className="contact-wave" aria-hidden="true"></span><Img className="orb" sizes="(max-width: 600px) 31vw, (max-width: 1000px) 24vw, 270px" src="/assets/earth.webp" alt="" width={1600} height={1600} draggable={false} fetchPriority="high" /></div><div className="reach-hand reach-left"><Img sizes="(max-width: 600px) 78vw, (max-width: 1000px) 59vw, 655px" src="/assets/reach-left.webp" alt="" width={887} height={887} draggable={false} fetchPriority="high" /></div><div className="reach-hand reach-right"><Img sizes="(max-width: 600px) 78vw, (max-width: 1000px) 59vw, 655px" src="/assets/reach-right.webp" alt="" width={887} height={887} draggable={false} fetchPriority="high" /></div></div></div><div className="copy"><p className="eyebrow reveal-load" style={st({ "--i": "0" })}>{content.eyebrow}</p><h1 className="title reveal-load" style={st({ "--i": "1" })}><Rich glue>{content.title}</Rich></h1><div className="actions reveal-load" style={st({ "--i": "2" })}><a href={content.primaryCta.href} className="pill">{`${content.primaryCta.label} `}<span className="badge"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span></a>{content.secondaryCta && <a href={content.secondaryCta.href} className="arrow-link">{`${content.secondaryCta.label} `}<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></a>}</div></div></HeroBanner></section>
    </>
  );
}
