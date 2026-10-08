import { FilterProvider } from "@/components/motion/Filter";
import Aurora from "@/components/site/ui/Aurora";
import FilterChips, { type Chip } from "@/components/site/ui/FilterChips";
import Rich from "@/components/site/ui/Rich";
import ReviewsSection from "@/components/site/ui/ReviewsSection";
import type { ReviewSeed } from "@/content/reviews";
import type { CaseStudy } from "@/content/types";
import type { ReviewsCarouselSection, SiteRatingSection, WorksGridSection, WorksHeroSection } from "@/lib/cms/sections";
import { st } from "@/lib/css";
import WorksGrid from "./WorksGrid";

/** The disciplines a case study can be filtered by, in the order of the chips. The keys join to the case studies' filters, so they are fixed; the labels are content. */
const DISCIPLINES = ["brand", "product", "web", "packaging", "motion"] as const;

type Props = {
  cases: CaseStudy[];
  hero: WorksHeroSection;
  grid: WorksGridSection;
  /** The reviews carousel; null when the section is switched off. */
  reviews: { content: ReviewsCarouselSection; items: readonly ReviewSeed[]; rating: SiteRatingSection } | null;
};

/** The works index: heading, discipline chips, the grid of case study cards, then the reviews carousel. `cases` come from the database, in the editors' order; the words from the page CMS. */
export default function WorksPage({ cases, hero, grid, reviews }: Props) {
  const chips: Chip[] = [
    { key: "all", label: hero.allLabel, count: cases.length },
    ...DISCIPLINES.map((key) => ({ key, label: hero.chipLabels[key], count: cases.filter((c) => c.card.filters.includes(key)).length })),
  ];
  return (
    <>
      <FilterProvider>
        <div className="hero-run has-aurora">
          <Aurora />
          <section className="works-hero" id="top" aria-labelledby="works-title">
            <div className="wrap">
              {hero.label && <p className="label reveal">{hero.label}</p>}
              <h1 className="h1 reveal" id="works-title" style={st({ "--i": 0 })}><Rich>{hero.title}</Rich></h1>
              <p className="lead reveal" style={st({ "--i": 1 })}>{hero.lead}</p>
              <FilterChips chips={chips} ariaLabel="Filter by discipline" />
            </div>
          </section>

          <section className="works-grid-sec" aria-label="Case studies">
            <div className="wrap">
              <WorksGrid cases={cases} emptyText={grid.emptyText} />
            </div>
          </section>
        </div>
      </FilterProvider>

      {reviews && (
        <ReviewsSection
          className="sec reviews works-reviews has-aurora glow-right"
          id="reviews"
          label={reviews.content.label}
          title={<Rich>{reviews.content.title}</Rich>}
          reviews={reviews.items}
          rating={reviews.rating}
        />
      )}
    </>
  );
}
