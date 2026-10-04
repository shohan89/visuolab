import { FilterProvider } from "@/components/motion/Filter";
import Aurora from "@/components/site/ui/Aurora";
import FilterChips, { type Chip } from "@/components/site/ui/FilterChips";
import ReviewsSection from "@/components/site/ui/ReviewsSection";
import { caseBySlug, worksOrder } from "@/content/cases";
import type { CaseStudy } from "@/content/types";
import { st } from "@/lib/css";
import WorksGrid from "./WorksGrid";

const DISCIPLINES: { key: string; label: string }[] = [
  { key: "brand", label: "Brand" },
  { key: "product", label: "Product" },
  { key: "web", label: "Web" },
  { key: "packaging", label: "Packaging" },
  { key: "motion", label: "Motion" },
];

/** The works index: heading, discipline chips, the grid of case study cards, then the reviews carousel. */
export default function WorksPage() {
  const cases = worksOrder.map((s) => caseBySlug(s)).filter((c): c is CaseStudy => !!c);
  const chips: Chip[] = [
    { key: "all", label: "All", count: cases.length },
    ...DISCIPLINES.map((d) => ({ ...d, count: cases.filter((c) => c.card.filters.includes(d.key)).length })),
  ];
  return (
    <>
      <FilterProvider>
        <div className="hero-run has-aurora">
          <Aurora />
          <section className="works-hero" id="top" aria-labelledby="works-title">
            <div className="wrap">
              <p className="label reveal">Works</p>
              <h1 className="h1 reveal" id="works-title" style={st({ "--i": 0 })}>Work that <em>moved</em> the needle</h1>
              <p className="lead reveal" style={st({ "--i": 1 })}>140+ launches since 2017. These are the ones we&apos;re proudest of — each with the brief, the thinking and the numbers behind it.</p>
              <FilterChips chips={chips} ariaLabel="Filter by discipline" />
            </div>
          </section>

          <section className="works-grid-sec" aria-label="Case studies">
            <div className="wrap">
              <WorksGrid cases={cases} />
            </div>
          </section>
        </div>
      </FilterProvider>

      <ReviewsSection
        className="sec reviews works-reviews has-aurora glow-right"
        id="reviews"
        label="Testimonials"
        title={<>What the <em>clients</em> behind these projects say</>}
      />
    </>
  );
}
