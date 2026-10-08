import { getSiteConfig } from "@/lib/server/site-config";
import { st } from "@/lib/css";
import Faq from "@/components/motion/Faq";
import Rich from "@/components/site/ui/Rich";
import type { FaqAccordionSection, OpenRolesSection } from "@/lib/cms/sections";

type Props = {
  /** The FAQ; null when the section is switched off. */
  faq: FaqAccordionSection | null;
  /** The open roles; null when the section is switched off. */
  careers: OpenRolesSection | null;
};

/** FAQ and open roles, which share one background. The words come from the page CMS; the e-mail address from Settings > Contact. */
export default async function AboutFaqRun({ faq, careers }: Props) {
  const EMAIL = (await getSiteConfig()).contact.email;
  return (
    <>
      <div className="faq-run has-aurora glow-left"><div className="aurora" aria-hidden="true"><span className="s1"></span><span className="s2"></span></div>{faq && <section className="sec faq" id="faq" aria-labelledby="faq-title"><div className="wrap"><div className="faq-grid"><div className="faq-intro"><div className="sec-grid">{faq.label && <p className="label reveal">{faq.label}</p>}<h2 className="h2 reveal" id="faq-title" style={st({ "--i": "0" })}><Rich>{faq.title}</Rich></h2>{faq.lead && <p className="lead reveal" style={st({ "--i": "1" })}>{faq.lead}</p>}</div>{faq.cta && <a href={faq.cta.href || `mailto:${EMAIL}`} className="pill reveal" style={st({ "--i": "2" })}>{`${faq.cta.label} `}<span className="badge"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span></a>}</div><Faq index={1} items={faq.items.map((it, i) => ({ id: `qa-${i + 1}`, q: it.question, a: it.answer }))} /></div></div></section>}{careers && <section className="sec" id="careers" aria-labelledby="careers-title"><div className="wrap"><div className="sec-grid careers-head" style={st({ "marginBottom": "clamp(28px,4vh,40px)" })}>{careers.label && <p className="label reveal">{careers.label}</p>}<h2 className="h2 reveal" id="careers-title" style={st({ "--i": "0" })}><Rich>{careers.title}</Rich></h2></div><div className="roles reveal">{careers.items.map((r, i) => <a href={`mailto:${EMAIL}?subject=${encodeURIComponent(r.subject)}`} className="role" key={i}><b>{r.title}</b><span>{r.meta}</span><svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></a>)}</div></div></section>}</div>
    </>
  );
}
