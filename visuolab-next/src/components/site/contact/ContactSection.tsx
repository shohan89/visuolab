import { getSiteConfig } from "@/lib/server/site-config";
import { getMediaIndex, getPage, mediaSrc } from "@/lib/server/cms-pages";
import { st } from "@/lib/css";
import ContactForm from "@/components/site/contact/ContactForm";
import { turnstileGate } from "@/lib/server/integrations";
import Img from "@/components/site/ui/Img";
import Rich from "@/components/site/ui/Rich";

/** The contact page: intro and form. The words come from the page CMS (the e-mail address from Settings > Contact); the form's fields, rules and what is sent are fixed in code. */
export default async function ContactSection() {
  const [email, gate, { content, enabled }, media] = await Promise.all([
    getSiteConfig().then((c) => c.contact.email),
    turnstileGate(), // the site key only, and only when bot protection is on and fully set up
    getPage("contact"),
    getMediaIndex(),
  ]);
  const intro = content.intro;
  const mail = (text: string) => text.replaceAll("{email}", email);
  return (
    <>
      <section className="contact-page hero-run has-aurora" id="top" aria-labelledby={enabled.intro ? "contact-title" : undefined}><div className="aurora" aria-hidden="true"><span className="s1"></span><span className="s2"></span></div><div className="wrap"><div className="contact-grid">{enabled.intro && <div className="contact-intro"><p className="label reveal">{intro.label}</p><h1 className="h1 reveal" id="contact-title" style={st({ "--i": "0" })}><Rich>{intro.title}</Rich></h1>{intro.who && <div className="who-answers reveal" style={st({ "--i": "2" })}>{intro.who.avatar && <Img className="avatar" src={mediaSrc(intro.who.avatar, media)} alt={intro.who.avatar.alt} />}<div><b>{intro.who.name}</b><span>{intro.who.role}</span></div></div>}<ul className="contact-direct reveal" style={st({ "--i": "3" })}>{intro.direct.map((d, i) => <li key={i}>{d.label && <span className="label">{d.label}</span>}<a href={`mailto:${email}${d.mailSubject ? `?subject=${encodeURIComponent(d.mailSubject)}` : ""}`}>{`${mail(d.text)} `}<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></a></li>)}</ul>{intro.facts.length > 0 && <ul className="contact-facts reveal" style={st({ "--i": "4" })}>{intro.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>}</div>}{enabled.form && <div className="contact-form-wrap reveal" style={st({ "--i": "1" })} id="form"><ContactForm content={content.form} turnstileKey={gate.active ? gate.siteKey : ""} /></div>}</div></div></section>
    </>
  );
}
