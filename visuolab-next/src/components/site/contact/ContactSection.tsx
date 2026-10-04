import { st } from "@/lib/css";
import ContactForm from "@/components/site/contact/ContactForm";

export default function ContactSection() {
  return (
    <>
      <section className="contact-page hero-run has-aurora" id="top" aria-labelledby="contact-title"><div className="aurora" aria-hidden="true"><span className="s1"></span><span className="s2"></span></div><div className="wrap"><div className="contact-grid"><div className="contact-intro"><p className="label reveal">Contact</p><h1 className="h1 reveal" id="contact-title" style={st({ "--i": "0" })}>{"Tell us where you are and where you want to "}<em>be</em></h1><div className="who-answers reveal" style={st({ "--i": "2" })}><img className="avatar" src="/assets/people/jordan.webp" alt="" /><div><b>Jordan Ellis</b><span>{"Founder & Creative Director — answers new enquiries"}</span></div></div><ul className="contact-direct reveal" style={st({ "--i": "3" })}><li><span className="label">Email</span><a href="mailto:hello@visuolab.studio">{"hello@visuolab.studio "}<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></a></li><li><span className="label">New business</span><a href="mailto:hello@visuolab.studio?subject=New%20project">{"Book a 30-min intro call "}<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></a></li></ul><ul className="contact-facts reveal" style={st({ "--i": "4" })}><li>Answer within 1 working day</li><li>{"Lisbon & remote — 4 continents"}</li><li>{"Projects from €20k"}</li></ul></div><div className="contact-form-wrap reveal" style={st({ "--i": "1" })} id="form"><ContactForm /></div></div></div></section>
    </>
  );
}
