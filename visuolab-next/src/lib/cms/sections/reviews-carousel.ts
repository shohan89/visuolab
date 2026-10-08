/** The reviews carousel (Home, Works, every service page): its label and heading. The reviews and the rating line are the shared ones. */
import { z } from "zod";
import { rich, text } from "../primitives.ts";

export const reviewsCarouselSchema = z.strictObject({
  label: text("Label", 24),
  title: rich("Heading", 80),
});
export type ReviewsCarouselSection = z.infer<typeof reviewsCarouselSchema>;
