import { st } from "@/lib/css";

export default function CtaBand() {
  return (
    <>
      <section className="cta" id="contact"><div className="floaters" aria-hidden="true"><div className="floater f1"><img src="/assets/cases/orbit.webp" alt="" loading="lazy" /></div><div className="floater f2"><img src="/assets/cases/kite.webp" alt="" loading="lazy" /></div><div className="floater f3"><img src="/assets/cases/marlow.webp" alt="" loading="lazy" /></div><div className="floater f4"><img src="/assets/cases/verdant.webp" alt="" loading="lazy" /></div></div><div className="wrap"><div className="avatars reveal" style={st({ "--i": "0" })}><img className="avatar" src="/assets/people/jordan.webp" alt="" /><img className="avatar" src="/assets/people/team-2.webp" alt="" /><img className="avatar" src="/assets/people/aiko.webp" alt="" /><span className="plus">+</span><span className="you">You</span></div><h2 className="h2 reveal" style={st({ "--i": "1" })}>{"Ready to discuss your "}<em>project</em>{" with us?"}</h2><p className="lead reveal" style={st({ "--i": "2" })}>{"Tell us where you are and where you want to be. We'll come back within a day with how we'd get you there."}</p><div className="actions reveal" style={st({ "--i": "3" })}><a href="mailto:hello@visuolab.studio" className="pill">{"Book a call "}<span className="badge"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span></a><a href="mailto:hello@visuolab.studio" className="arrow-link">{"hello@visuolab.studio "}<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></a></div></div></section>
    </>
  );
}
