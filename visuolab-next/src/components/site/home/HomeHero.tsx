import { st } from "@/lib/css";
import HeroBanner from "@/components/motion/HeroBanner";
import MeshFlow from "@/components/motion/MeshFlow";
import Stars from "@/components/motion/Stars";

export default function HomeHero() {
  return (
    <>
      <section className="scroll-sequence" id="top" aria-label="Introduction"><HeroBanner className="banner reaching"><MeshFlow><span className="m1"></span><span className="m2"></span><span className="m3"></span><span className="m4"></span><span className="m5"></span></MeshFlow><Stars /><div className="stage"><div className="scene" role="img" aria-label="Two human hands reach toward each other in front of a glowing sphere. Scrolling brings the fingertips together."><div className="orb-layer"><span className="contact-wave" aria-hidden="true"></span><img className="orb" src="/assets/earth.webp" alt="" width={1600} height={1600} draggable={false} fetchPriority="high" /></div><div className="reach-hand reach-left"><img src="/assets/reach-left.webp" alt="" width={887} height={887} draggable={false} fetchPriority="high" /></div><div className="reach-hand reach-right"><img src="/assets/reach-right.webp" alt="" width={887} height={887} draggable={false} fetchPriority="high" /></div></div></div><div className="copy"><p className="eyebrow reveal-load" style={st({ "--i": "0" })}>Digital product design agency</p><h1 className="title reveal-load" style={st({ "--i": "1" })}>{"The design partner that unites "}<span className="nb"><em>brand</em>,</span>{" "}<em>website</em>{" and "}<em>product</em>{" into one story."}</h1><div className="actions reveal-load" style={st({ "--i": "2" })}><a href="#contact" className="pill">{"Book a call "}<span className="badge"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span></a><a href="#work" className="arrow-link">{"See our work "}<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></a></div></div></HeroBanner></section>
    </>
  );
}
