/** The reviews shown in the carousels of Home, Works and the service pages. */
import { z } from "zod";
import { hexColour, list, mediaRef, text } from "../primitives.ts";

export const reviewsCollectionSchema = z.strictObject({
  items: list(
    z.strictObject({
      avatar: mediaRef("Photo").nullable(),
      company: text("Company", 24),
      dot: hexColour,
      quote: text("Quote", 140),
      name: text("Name", 28),
      role: text("Role", 44),
      city: text("City", 24),
    }),
    "Reviews",
    3,
    10,
    "review",
  ),
});
export type ReviewsCollectionSection = z.infer<typeof reviewsCollectionSchema>;
