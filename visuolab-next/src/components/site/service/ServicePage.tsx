import Link from "@/components/site/ui/Link";
import CaseStack from "@/components/motion/CaseStack";
import Stairs from "@/components/motion/Stairs";
import CasePanel from "@/components/site/case/CasePanel";
import Aurora from "@/components/site/ui/Aurora";
import LogoMarquee from "@/components/site/ui/LogoMarquee";
import { PillBadge } from "@/components/site/ui/Pill";
import Rich from "@/components/site/ui/Rich";
import SvgIcon from "@/components/site/ui/SvgIcon";
import type { LogoSeed } from "@/content/logos";
import type { ReviewSeed } from "@/content/reviews";
import type { ServiceSeed } from "@/content/types";
import type { LogoMarqueeSection, ReviewsCarouselSection, SiteRatingSection } from "@/lib/cms/sections";
import { st } from "@/lib/css";
import ServiceReviews from "./ServiceReviews";
import Img from "@/components/site/ui/Img";

/** The words and lists that are the same on every service page (the page CMS: `service_detail` and the shared page). */
export type ServiceChrome = {
  rating: SiteRatingSection;
  /** The "Trusted by" band under the hero; null when switched off. */
  logos: { content: LogoMarqueeSection; items: readonly LogoSeed[] } | null;
  /** The reviews carousel at the end; null when switched off. */
  reviews: { content: ReviewsCarouselSection; items: readonly ReviewSeed[] } | null;
};

/**
 * A service detail page. The four services share one layout, so one component renders any ServiceSeed.
 * Markup, class names and the --i stagger indexes follow service/*.html. The original put "svc-page" on <body>;
 * the shared layout owns <body>, so the same class sits on this wrapper (its rules are all descendant selectors).
 */
export default function ServicePage({ service: s, chrome, hidden = [] }: { service: ServiceSeed; chrome: ServiceChrome; /** keys of the sections an editor switched off */ hidden?: readonly string[] }) {
  const off = new Set(hidden);
  return (
    <div className="svc-page">
      <div className="svc-run hero-run has-aurora">
        <Aurora />

        {!off.has("hero") && (
        <section className="svc-hero" id="top" aria-labelledby="svc-title">
          <div className="wrap">
            <div className="svc-lead-grid">
              <div className="svc-copy">
                <h1 className="h1 reveal" id="svc-title" style={st({ "--i": 0 })}><Rich>{s.hero.title}</Rich></h1>
                <p className="lead reveal" style={st({ "--i": 1 })}>{s.hero.lead}</p>
                <div className="svc-cta-row reveal" style={st({ "--i": 2 })}>
                  <Link className="pill" href={s.hero.cta.href}>{s.hero.cta.label} <PillBadge /></Link>
                  <div className="rev-badge"><span className="stars">★★★★★</span><span><b>{chrome.rating.score}</b>{` · ${chrome.rating.text}`}</span></div>
                </div>
              </div>
              <div className="svc-shot reveal" style={st({ "--i": 1 })} aria-hidden="true">
                {s.hero.shots.map((img, i) => (
                  <figure className={i === 0 ? "a" : "b"} key={img.src}>
                    <Img
                      src={img.src}
                      alt={img.alt}
                      width={img.width}
                      height={img.height}
                      {...(img.priority ? { fetchPriority: "high" as const } : {})}
                      {...(img.lazy ? { loading: "lazy" as const } : {})}
                    />
                  </figure>
                ))}
              </div>
            </div>
            {chrome.logos && (
              <div className="logos reveal" style={st({ "--i": 3 })}>
                {chrome.logos.content.label && <p className="label">{chrome.logos.content.label}</p>}
                <LogoMarquee items={chrome.logos.items} />
              </div>
            )}
          </div>
        </section>
        )}

        {/* "What we fix": present in the original but hidden; the flag decides */}
        <section className="sec prob-sec" aria-labelledby="prob-title" hidden={s.problems.hidden}>
          <div className="wrap">
            <div className="sec-grid"><p className="label reveal">{s.problems.label}</p><h2 className="h2 reveal" id="prob-title" style={st({ "--i": 0 })}><Rich>{s.problems.title}</Rich></h2></div>
            <div className="probs">
              {s.problems.items.map((p, i) => (
                <div className="prob reveal" style={st({ "--i": i % 3 })} key={p.title}>
                  <b>{p.title}</b>
                  <p>{p.text}</p>
                  <span className="proof"><b><Rich>{p.proofValue}</Rich></b>{p.proofLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {!off.has("overview") && (
        <section className="sec svc-intro" aria-labelledby="ov-title">
          <div className="wrap">
            <div className="overview">
              <p className="label reveal">{s.overview.label}</p>
              <h2 className="h2 overview-title reveal" id="ov-title" style={st({ "--i": 0 })}><Rich>{s.overview.title}</Rich></h2>
              <div>
                {s.overview.blocks.map((b, i) => (
                  <div className="block reveal" style={st({ "--i": i })} key={b.title}><h3>{b.title}</h3><p>{b.text}</p></div>
                ))}
              </div>
            </div>
          </div>
        </section>
        )}
      </div>

      {!off.has("outcomes") && (
      <section className="sec out-sec" aria-labelledby="out-title">
        <div className="wrap">
          <div className="out-head">
            <div className="sec-grid"><p className="label reveal">{s.outcomes.label}</p><h2 className="h2 reveal" id="out-title" style={st({ "--i": 0 })}><Rich>{s.outcomes.title}</Rich></h2></div>
          </div>
          <div className="outs">
            {s.outcomes.items.map((o, i) => (
              <div className="out reveal" style={st({ "--i": i })} key={o.text}><b><Rich>{o.value}</Rich></b><p>{o.text}</p></div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Inline CTA band: present in the original but hidden */}
      <section className="sec band-sec" aria-label="Start a project" hidden={s.band.hidden}>
        <div className="wrap">
          <div className="svc-band reveal">
            <p><Rich>{s.band.text}</Rich></p>
            <Link className="pill" href={s.band.cta.href}>{s.band.cta.label} <PillBadge /></Link>
          </div>
        </div>
      </section>

      {!off.has("included") && (
      <section className="sec incl-sec" aria-labelledby="incl-title">
        <div className="wrap">
          <div className="sec-grid"><p className="label reveal">{s.included.label}</p><h2 className="h2 reveal" id="incl-title" style={st({ "--i": 0 })}><Rich>{s.included.title}</Rich></h2></div>
          <div className="incls">
            {s.included.items.map((it, i) => (
              <div className="incl reveal" style={st({ "--i": i % 3 })} key={it.title}>
                <span className="ico"><SvgIcon icon={it.icon} /></span>
                <b>{it.title}</b>
                <p>{it.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {!off.has("process") && (
      <section className="sec process-sec has-aurora glow-right" aria-labelledby="proc-title">
        <Aurora />
        <div className="wrap">
          <div className="sec-grid"><p className="label reveal">{s.process.label}</p><h2 className="h2 reveal" id="proc-title" style={st({ "--i": 0 })}><Rich>{s.process.title}</Rich></h2></div>
          <Stairs idPrefix={`stair-${s.slug}`} steps={s.process.steps} />
        </div>
      </section>
      )}

      {!off.has("case-studies") && (
      <section className="sec svc-cases" aria-labelledby="cases-title">
        <div className="wrap">
          <div className="sec-grid cases-head">
            <p className="label reveal">{s.cases.label}</p>
            <h2 className="h2 reveal" id="cases-title"><Rich>{s.cases.title}</Rich></h2>
          </div>
          <CaseStack>
            {s.cases.items.map((c) => <CasePanel item={c} key={c.href} />)}
          </CaseStack>
        </div>
      </section>
      )}

      {chrome.reviews && <ServiceReviews content={chrome.reviews.content} reviews={chrome.reviews.items} rating={chrome.rating} />}
    </div>
  );
}
