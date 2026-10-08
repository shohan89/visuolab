import Rich from "@/components/site/ui/Rich";
import ReviewsSection from "@/components/site/ui/ReviewsSection";
import type { ReviewSeed } from "@/content/reviews";
import type { ReviewsCarouselSection, SiteRatingSection } from "@/lib/cms/sections";

/** "What our clients say": the home carousel, dark, with the glow behind it (service pages). The words and the reviews come from the page CMS. */
export default function ServiceReviews({ content, reviews, rating }: { content: ReviewsCarouselSection; reviews: readonly ReviewSeed[]; rating: SiteRatingSection }) {
  return (
    <ReviewsSection
      className="sec svc-reviews has-aurora glow-left"
      ariaLabelledBy="rev-title"
      label={content.label}
      titleId="rev-title"
      title={<Rich>{content.title}</Rich>}
      reviews={reviews}
      rating={rating}
    />
  );
}
