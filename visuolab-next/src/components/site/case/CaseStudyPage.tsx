import Link from "@/components/site/ui/Link";
import Stairs from "@/components/motion/Stairs";
import Aurora from "@/components/site/ui/Aurora";
import { PillBadge } from "@/components/site/ui/Pill";
import Rich from "@/components/site/ui/Rich";
import type { CaseFigure, CaseStudy } from "@/content/types";
import { st } from "@/lib/css";

const pos = (f: CaseFigure) => (f.position ? { objectPosition: f.position } : undefined);

function Gallery({ figures }: { figures: CaseFigure[] }) {
  return (
    <section className="gallery-sec" aria-label="Project images">
      <div className="wrap">
        <div className="gallery">
          {figures.map((f, i) => (
            <figure className="reveal" style={st({ "--i": i })} key={f.caption}>
              <img src={f.src} alt={f.alt} loading="lazy" style={pos(f)} />
              <figcaption>{f.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * A case study page. All eight case studies share one layout and differ only in content, so one component
 * renders any CaseStudy. Markup, class names and --i stagger indexes follow work/*.html.
 */
export default function CaseStudyPage({ study: c }: { study: CaseStudy }) {
  return (
    <>
      <div className="hero-run has-aurora">
        <Aurora />
        <section className="work-hero" id="top" aria-labelledby="case-title">
          <div className="wrap">
            <p className="crumbs reveal"><Link href="/works">Works</Link><span>/</span><span>{c.hero.breadcrumb}</span></p>
            <h1 className="h1 reveal" id="case-title" style={st({ "--i": 0 })}><Rich>{c.hero.title}</Rich></h1>
            <dl className="meta reveal" style={st({ "--i": 1 })}>
              {c.hero.facts.map((f) => (
                <div key={f.term}><dt>{f.term}</dt><dd>{f.value}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        <section className="cover-wrap" aria-hidden="true">
          <div className="wrap"><div className="cover reveal"><img src={c.cover.src} alt={c.cover.alt} /></div></div>
        </section>
      </div>

      <section className="sec about-project" aria-labelledby="about-title">
        <div className="wrap">
          <div className="about-grid">
            <p className="label reveal" id="about-title">{c.about.label}</p>
            <p className="about-lead reveal" style={st({ "--i": 1 })}><Rich>{c.about.lead}</Rich></p>
          </div>
          <div className="stats reveal-group">
            {c.about.stats.map((s, i) => (
              <div className="stat reveal" style={st({ "--i": i })} key={s.label}><b><Rich>{s.value}</Rich></b><span>{s.label}</span></div>
            ))}
          </div>
        </div>
      </section>

      <Gallery figures={c.galleryA} />

      <section className="sec chapters-sec process-sec has-aurora glow-right" aria-labelledby="chapters-title">
        <Aurora />
        <div className="wrap">
          <div className="sec-grid"><p className="label reveal">{c.process.label}</p><h2 className="h2 reveal" id="chapters-title" style={st({ "--i": 0 })}><Rich>{c.process.title}</Rich></h2></div>
          <Stairs idPrefix={`stair-${c.slug}`} steps={c.process.steps} />
        </div>
      </section>

      <Gallery figures={c.galleryB} />

      <section className="sec challenges-sec" aria-labelledby="challenges-title">
        <div className="wrap">
          <div className="ws">
            <div className="ws-head">
              <p className="label reveal">{c.challenges.label}</p>
              <h2 className="ws-title reveal" id="challenges-title" style={st({ "--i": 0 })}><Rich>{c.challenges.title}</Rich></h2>
            </div>
            <div className="ws-body">
              <ol className="challenges reveal" style={st({ "--i": 1 })}>
                {c.challenges.items.map((it, i) => (
                  <li key={it.title}><span className="n">{String(i + 1).padStart(2, "0")}</span><h3>{it.title}</h3><p>{it.text}</p></li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="wide-sec" aria-hidden="true">
        <div className="wrap">
          <figure className="wide-img reveal">
            <img src={c.wide.src} alt={c.wide.alt} loading="lazy" style={pos(c.wide)} />
            <figcaption>{c.wide.caption}</figcaption>
          </figure>
        </div>
      </section>

      <section className="sec results-sec" aria-labelledby="results-title">
        <div className="wrap">
          <div className="ws">
            <div className="ws-head">
              <p className="label reveal">{c.results.label}</p>
              <h2 className="ws-title reveal" id="results-title" style={st({ "--i": 0 })}><Rich>{c.results.title}</Rich></h2>
            </div>
            <div className="ws-body">
              <ul className="results reveal" style={st({ "--i": 1 })}>
                {c.results.items.map((r) => (
                  <li className={r.metric ? "is-num" : undefined} key={r.text}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M8 12.4l2.6 2.6 5.4-5.6" /></svg>
                    <span><Rich>{r.text}</Rich></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="sec more-sec" aria-labelledby="more-title">
        <div className="wrap">
          <div className="more-head">
            <div className="sec-grid"><p className="label reveal">{c.more.label}</p><h2 className="h2 reveal" id="more-title" style={st({ "--i": 0 })}><Rich>{c.more.title}</Rich></h2></div>
            <Link className="pill ghost reveal" style={st({ "--i": 1 })} href="/works">All projects <PillBadge /></Link>
          </div>
          <div className="more">
            {c.more.items.map((m, i) => (
              <Link className="reveal" style={st({ "--i": i })} href={`/works/${m.slug}`} key={m.slug}>
                <div className="img"><img src={m.image} alt="" loading="lazy" /></div>
                <b>{m.name}</b>
                <span>{m.kind}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
