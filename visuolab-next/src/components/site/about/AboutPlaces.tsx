import type { ReactNode } from "react";
import { st } from "@/lib/css";
import Clock from "@/components/motion/Clock";
import Rich from "@/components/site/ui/Rich";
import type { OfficeClocksSection } from "@/lib/cms/sections";

/** The flags drawn in code (the list the schema accepts). A flag is part of the design: it is chosen by code, never uploaded. */
const FLAG: Record<OfficeClocksSection["items"][number]["flag"], { name: string; svg: ReactNode }> = {
  PT: { name: "Portugal", svg: <><rect width={30} height={20} fill="#f00" /><rect width={12} height={20} fill="#060" /><circle cx="12" cy="10" r="4.2" fill="#ff0" /><circle cx="12" cy="10" r="4.2" fill="none" stroke="#fff" strokeWidth=".5" /><path d="M9.4 8.2h5.2v3c0 1.6-1.3 2.6-2.6 3.1-1.3-.5-2.6-1.5-2.6-3.1z" fill="#fff" stroke="#f00" strokeWidth=".55" /></> },
  CA: { name: "Canada", svg: <><rect width={30} height={20} fill="#fff" /><rect width="7.5" height={20} fill="#d52b1e" /><rect x="22.5" width="7.5" height={20} fill="#d52b1e" /><path d="M15 4.4l1.1 2.05c.12.23.35.21.58.08l.79-.41-.57 3.04c-.12.57.28.57.47.33l1.38-1.55.45 1.05c.09.19.26.16.47.12l1.42-.3-.42 1.53c-.09.33-.15.47.09.57l.3.14-1.48 1.2c-.17.15-.12.19-.06.43l.26.86-2.79-.48c-.34-.06-.47.1-.47.29l.12 2.1h-1.04l.11-2.1c0-.19-.13-.35-.47-.29l-2.79.48.26-.86c.06-.24.11-.28-.06-.43l-1.48-1.2.3-.14c.24-.1.18-.24.09-.57l-.42-1.53 1.42.3c.21.04.38.07.47-.12l.45-1.05 1.38 1.55c.19.24.59.24.47-.33l-.57-3.04.79.41c.23.13.46.14.58-.08z" fill="#d52b1e" /></> },
  SG: { name: "Singapore", svg: <><rect width={30} height={20} fill="#fff" /><rect width={30} height={10} fill="#ed2939" /><circle cx="7.4" cy="5" r="3.5" fill="#fff" /><circle cx="9.2" cy="5" r="3" fill="#ed2939" /><g fill="#fff"><circle cx="11.6" cy="2.7" r=".72" /><circle cx="14" cy="4.4" r=".72" /><circle cx="13.1" cy="7.2" r=".72" /><circle cx="10.1" cy="7.2" r=".72" /><circle cx="9.2" cy="4.4" r=".72" /></g></> },
  AU: { name: "Australia", svg: <><rect width={30} height={20} fill="#00247d" /><g stroke="#fff" strokeWidth="2.2"><path d="M0 0l15 10M15 0L0 10" /></g><g stroke="#f00" strokeWidth="1"><path d="M0 0l15 10M15 0L0 10" /></g><path d="M7.5 0v10M0 5h15" stroke="#fff" strokeWidth="3.4" /><path d="M7.5 0v10M0 5h15" stroke="#f00" strokeWidth="2" /><g fill="#fff"><circle cx="7.5" cy="15" r="1.5" /><circle cx="24" cy="4" r="1" /><circle cx="27" cy="9.5" r="1" /><circle cx="22.5" cy="13.5" r="1.1" /><circle cx="20" cy="8" r=".8" /><circle cx="24.5" cy="9" r=".6" /></g></> },
};

/** Offices: live clocks. The words and the offices come from the page CMS; the flags, the clock and its "working now" logic are fixed in code. */
export default function AboutPlaces({ content }: { content: OfficeClocksSection }) {
  return (
    <>
      <section className="sec places" id="places" aria-labelledby="places-title"><div className="wrap"><div className="places-head"><div className="sec-grid">{content.label && <p className="label reveal">{content.label}</p>}<h2 className="h2 reveal" id="places-title" style={st({ "--i": "0" })}><Rich>{content.title}</Rich></h2></div>{content.lead && <p className="lead reveal" style={st({ "--i": "1" })}>{content.lead}</p>}</div><div className="clocks reveal-group">{content.items.map((o, i) => <Clock tz={o.timeZone} index={i} city={o.city} country={o.country} flag={<svg viewBox="0 0 30 20" role="img" aria-label={FLAG[o.flag].name}><title>{FLAG[o.flag].name}</title>{FLAG[o.flag].svg}</svg>} key={i} />)}</div></div></section>
    </>
  );
}
