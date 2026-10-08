import { st } from "@/lib/css";
import CarouselNav from "@/components/motion/CarouselNav";
import Img from "@/components/site/ui/Img";
import Rich from "@/components/site/ui/Rich";
import type { ReviewSeed } from "@/content/reviews";
import type { ReviewsCarouselSection, SiteRatingSection } from "@/lib/cms/sections";

type Props = {
  content: ReviewsCarouselSection;
  /** The shared rating line ("5.0 ★★★★★ 60+ reviews on Clutch"): the stars are fixed. */
  rating: SiteRatingSection;
  /** The shared reviews. */
  reviews: readonly ReviewSeed[];
};

/** The reviews section of the home page. The words and the reviews come from the page CMS (the reviews are shared with Works and the service pages). */
export default function HomeReviews({ content, rating, reviews }: Props) {
  return (
    <>
      <section className="sec light reviews seam-top" id="reviews" data-light-offset="220"><div className="wrap"><div className="reviews-head"><div><p className="label reveal">{content.label}</p><h2 className="h2 reveal" style={st({ "--i": "0", "marginTop": "18px" })}><Rich>{content.title}</Rich></h2><div className="rating reveal" style={st({ "--i": "1" })}><b>{rating.score}</b>{" "}<span className="stars">{"★★★★★"}</span>{` ${rating.text}`}</div></div><CarouselNav><button className="round-btn" data-carousel="prev" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" /></svg></button><button className="round-btn" data-carousel="next" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button></CarouselNav></div><div className="carousel" id="carousel">{reviews.map((r, i) => <article className="review-card" key={i}><div className="top"><Img className="avatar" loading="lazy" src={r.avatar} alt="" /><span className="logo"><i style={r.dot ? st({ "background": r.dot }) : undefined}></i>{r.company}</span></div><span className="mark" aria-hidden="true">{"“"}</span><blockquote>{r.quote}</blockquote><div className="who"><b>{r.name}</b><span>{r.role}</span><span>{r.city}</span></div></article>)}</div></div></section>
    </>
  );
}
