import { useSharedContent } from "@/components/site/SharedContentProvider";
import { useSiteConfig } from "@/components/site/SiteConfigProvider";
import { st } from "@/lib/css";
import Img from "@/components/site/ui/Img";
import Rich from "@/components/site/ui/Rich";

/** The closing call to action on every page but Contact. The words and pictures come from the page CMS (the shared page); the e-mail address from Settings > Contact. */
export default function CtaBand() {
  const EMAIL = useSiteConfig().email;
  const { cta } = useSharedContent();
  return (
    <>
      <section className="cta" id="contact"><div className="floaters" aria-hidden="true">{cta.floaters.map((f, i) => <div className={`floater f${i + 1}`} key={i}><Img src={f.src} alt={f.alt} loading="lazy" /></div>)}</div><div className="wrap"><div className="avatars reveal" style={st({ "--i": "0" })}>{cta.avatars.map((a, i) => <Img className="avatar" loading="lazy" src={a.src} alt={a.alt} key={i} />)}<span className="plus">+</span><span className="you">You</span></div><h2 className="h2 reveal" style={st({ "--i": "1" })}><Rich>{cta.title}</Rich></h2>{cta.lead && <p className="lead reveal" style={st({ "--i": "2" })}>{cta.lead}</p>}<div className="actions reveal" style={st({ "--i": "3" })}><a href={cta.primary.href || `mailto:${EMAIL}`} className="pill">{`${cta.primary.label} `}<span className="badge"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span></a><a href={`mailto:${EMAIL}`} className="arrow-link">{`${EMAIL} `}<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></a></div></div></section>
    </>
  );
}
