import type { ReactNode } from "react";
import CarouselNav from "@/components/motion/CarouselNav";
import Aurora from "@/components/site/ui/Aurora";
import { reviews } from "@/content/reviews";
import { st } from "@/lib/css";
import Img from "@/components/site/ui/Img";

type Props = {
  /** Section classes, which decide the surface (dark service version, works version, ...) */
  className: string;
  id?: string;
  ariaLabelledBy?: string;
  label: string;
  title: ReactNode;
  titleId?: string;
};

/** The client-reviews carousel with its heading, rating line and prev/next buttons. Same list everywhere it appears. */
export default function ReviewsSection({ className, id, ariaLabelledBy, label, title, titleId }: Props) {
  return (
    <section className={className} id={id} aria-labelledby={ariaLabelledBy}>
      <Aurora />
      <div className="wrap">
        <div className="reviews-head">
          <div>
            <p className="label reveal">{label}</p>
            <h2 className="h2 reveal" id={titleId} style={st({ "--i": 0, marginTop: "18px" })}>{title}</h2>
            <div className="rating reveal" style={st({ "--i": 1 })}><b>5.0</b> <span className="stars">★★★★★</span> 60+ reviews on Clutch</div>
          </div>
          <CarouselNav>
            <button className="round-btn" data-carousel="prev" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" /></svg></button>
            <button className="round-btn" data-carousel="next" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          </CarouselNav>
        </div>
        <div className="carousel" id="carousel">
          {reviews.map((r) => (
            <article className="review-card" key={r.name}>
              <div className="top">
                <Img className="avatar" loading="lazy" src={r.avatar} alt="" />
                <span className="logo"><i style={r.dot ? { background: r.dot } : undefined}></i>{r.company}</span>
              </div>
              <span className="mark" aria-hidden="true">“</span>
              <blockquote>{r.quote}</blockquote>
              <div className="who"><b>{r.name}</b><span>{r.role}</span><span>{r.city}</span></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
