import Link from "@/components/site/ui/Link";
import type { CaseCardSeed } from "@/content/types";
import Rich from "@/components/site/ui/Rich";
import Img from "@/components/site/ui/Img";

/** One sticky case panel (.case). Two variants as in the original: a client quote, or a "Results" list. */
export default function CasePanel({ item }: { item: CaseCardSeed }) {
  return (
    <article className="case">
      <Link className="case-panel" href={item.href}>
        <div className="case-copy">
          <ul className="tags">
            {item.tags.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <h3 className="h3"><Rich>{item.title}</Rich></h3>
          {item.quote && (
            <div className="review">
              <div className="src">{item.quote.source} <span className="stars">★★★★★</span></div>
              <q>{item.quote.text}</q>
              <div className="who">
                <Img className="avatar" loading="lazy" src={item.quote.avatar} alt="" />
                <div><b>{item.quote.name}</b><span>{item.quote.role}</span></div>
              </div>
            </div>
          )}
          {item.results && (
            <div className="review case-results">
              <div className="src">Results</div>
              <ul>
                {item.results.map((r) => (
                  <li key={r.text}><b><Rich>{r.value}</Rich></b><span>{r.text}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="case-media">
          <Img src={item.image.src} alt={item.image.alt} loading="lazy" />
          <span className="case-open" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></span>
        </div>
      </Link>
    </article>
  );
}
