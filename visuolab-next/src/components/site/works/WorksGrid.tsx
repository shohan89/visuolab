"use client";

import Link from "@/components/site/ui/Link";
import { matchesFilter, useFilter } from "@/components/motion/Filter";
import type { CaseStudy } from "@/content/types";
import { st } from "@/lib/css";
import Img from "@/components/site/ui/Img";

/**
 * The works grid. Filtering hides non-matching cards (.is-hidden) and marks matching ones .in, exactly like the
 * original script did; until a chip has been used the classes are left alone so the scroll reveal can add .in itself.
 */
export default function WorksGrid({ cases }: { cases: CaseStudy[] }) {
  const { filter, touched } = useFilter();
  const shown = cases.filter((c) => matchesFilter(filter, c.card.filters)).length;
  return (
    <>
      <div className="works-grid" id="works-grid">
        {cases.map((c, i) => {
          const hit = matchesFilter(filter, c.card.filters);
          const state = touched ? (hit ? " in" : " is-hidden") : "";
          return (
            <Link className={`wcard reveal${state}`} style={st({ "--i": i % 2 })} href={`/works/${c.slug}`} data-tags={c.card.filters.join(" ")} key={c.slug}>
              <div className="wcard-media">
                {/* the first row is on the first screen: loaded at once, the first picture ahead of the rest; the others wait until they are near */}
                <Img src={c.card.image.src} alt={c.card.image.alt} {...(i < 2 ? (i === 0 ? { fetchPriority: "high" as const } : {}) : { loading: "lazy" as const })} />
                <span className="case-open" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></span>
              </div>
              <div className="wcard-body">
                <div className="wcard-top"><h2>{c.card.name}</h2><span className="year">{c.card.year}</span></div>
                <p className="type">{c.card.type}</p>
                <ul className="tags">
                  {c.card.tags.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="works-empty" hidden={shown > 0}>Nothing here yet — try another filter.</p>
    </>
  );
}
