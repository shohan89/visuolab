/** Showreel: a video that scales up as you scroll. The video must be an MP4; the poster shows until it plays. */
import { z } from "zod";
import { hint, mediaRef, optText } from "../primitives.ts";

export const showreelSchema = z.strictObject({
  video: mediaRef("Video (MP4)", "video"),
  poster: hint(mediaRef("Poster image"), "Shown until the video plays."),
  /** The small tag over the video. */
  tag: optText("Tag over the video", 24),
  /** A label such as "00:16"; it is not tied to the length of the video. */
  time: hint(optText("Length label", 8), "For example 00:16. It is only a label."),
});
export type ShowreelSection = z.infer<typeof showreelSchema>;
