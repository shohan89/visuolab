import ReviewsSection from "@/components/site/ui/ReviewsSection";

/** "What our clients say": the home carousel, dark, with the glow behind it (service pages). */
export default function ServiceReviews() {
  return (
    <ReviewsSection
      className="sec svc-reviews has-aurora glow-left"
      ariaLabelledBy="rev-title"
      label="Verified reviews"
      titleId="rev-title"
      title={<>What our <em>clients</em> say</>}
    />
  );
}
