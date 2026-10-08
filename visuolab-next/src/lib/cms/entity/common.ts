/* Building blocks shared by the section schemas of services, case studies and articles (on top of ../primitives.ts). */
import { z } from "zod";
import { linkOk } from "../../validation/service.ts";
import { isSafeHref, linkTargets } from "../../content/inline.ts";
import { group, mediaId, optText, richOk, text } from "../primitives.ts";

/** A picture whose description is required (the hero picture and card picture of a case study). */
export const mediaRefRequired = (label: string, hintText?: string) =>
  z.strictObject({ id: mediaId(label), alt: text(`${label} description`, 200) }).meta({ kind: "media", label, media: "image", ...(hintText ? { hint: hintText } : {}) });

/** Rich text (<em> and <b> only) that may be empty: a section that is switched off keeps whatever was typed. */
export const optRich = (label: string, max: number) =>
  z.string().trim().max(max, `${label} is too long (max ${max} characters)`).refine(richOk, `${label}: only <em>…</em> and <b>…</b> are allowed, and they must be closed`).meta({ kind: "rich", label });

/** A link as the service and article records accept it: a path, an anchor, a mail link or an https address. */
export const recordHref = (label: string) => z.string().trim().min(1, `${label} is required`).max(300).refine(linkOk, `${label} must start with / # mailto: or https://`).meta({ kind: "href", label });
export const recordHrefOpt = (label: string) => z.string().trim().max(300).refine((v) => v === "" || linkOk(v), `${label} must start with / # mailto: or https://`).meta({ kind: "href", label, optional: true });

/** A button: its words and where it goes. */
export const recordLink = (label: string, max = 40) => group(label, { label: text("Text", max), href: recordHref("Link") });

/** Article text: the small inline set (bold, italic, code, link) written as marks; shown as text, never run. Every link must be a safe address. */
export const inline = (label: string, max: number, min = 1) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`)
    .refine((v) => linkTargets(v).every(isSafeHref), `${label}: a link must start with / # mailto: or https://`)
    .meta({ kind: "text", label, hint: "Marks: **bold**  *italic*  `code`  [text](https://…)" });

/** Text around a link in the closing line: spaces at the ends belong to the sentence and are kept. */
export const spaced = (label: string, max: number) =>
  z.string().max(max, `${label} is too long (max ${max} characters)`).refine((v) => !/[<>]/.test(v), `${label} cannot contain < or >`).meta({ kind: "text", label });

/** "20% 30%": where a cropped picture is anchored. Empty: the default. */
export const cropPosition = z.string().trim().max(20, "Crop position is too long").refine((v) => v === "" || /^\d{1,3}% \d{1,3}%$/.test(v), "Crop position looks like 20% 30%")
  .meta({ kind: "text", label: "Crop position", hint: "Where a cropped picture is anchored, like 20% 30%. Empty: centred." });

export { optText };
