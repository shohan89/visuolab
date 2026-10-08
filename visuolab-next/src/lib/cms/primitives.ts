/*
 * The building blocks of every section schema. Relative imports with extensions on purpose: scripts/db/verify-pages.mjs loads these files
 * in plain Node.
 *
 * Every section schema is a strict object: a key the schema does not name is an error, so content can never grow fields nobody designed.
 *
 * Each block also carries a little metadata (`.meta({ kind, label, ... })`): which control edits it, what it is called, what noun its list items
 * use. The admin editor is generated from the schema and this metadata (src/lib/cms/describe.ts), so a field exists in the form because it exists
 * in the schema, with the limits the schema enforces (max length, number of items, optional or not) read from the schema itself.
 */
import { z } from "zod";
import { externalHrefOk, internalHrefOk } from "../validation/navigation.ts";

type Meta = Record<string, unknown>;

/** Adds a note shown under a field in the editor. */
export const hint = <T extends z.ZodType>(schema: T, text: string): T => schema.meta({ ...(z.globalRegistry.get(schema) ?? {}), hint: text }) as T;

/** Rich text allows only <em>…</em> and <b>…</b>, balanced. Anything else with angle brackets is refused. */
export const richOk = (v: string): boolean => {
  const open = (v.match(/<(em|b)>/g) ?? []).length;
  const close = (v.match(/<\/(em|b)>/g) ?? []).length;
  return open === close && !/[<>]/.test(v.replace(/<\/?(em|b)>/g, ""));
};
const plainOk = (v: string) => !/[<>]/.test(v);

/** Plain text, required. */
export const text = (label: string, max: number, min = 1) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`).refine(plainOk, `${label} cannot contain < or >`).meta({ kind: "text", label });
/** Plain text that may be empty (the field is optional: empty hides it). */
export const optText = (label: string, max: number) => text(label, max, 0);
/** Rich text, required: <em> and <b> only. */
export const rich = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`).refine(richOk, `${label}: only <em>…</em> and <b>…</b> are allowed, and they must be closed`).meta({ kind: "rich", label });
/** Rich text that may contain forced line breaks (a newline becomes <br>), at most `lines` lines. */
export const richLines = (label: string, max: number, lines: number) =>
  rich(label, max).refine((v) => v.split("\n").length <= lines, `${label}: at most ${lines} lines`).meta({ kind: "rich", label, lines: true, hint: `A new line starts a new line in the headline (at most ${lines} lines).` });

/** A link target: a path or anchor on this site, an https address, or a mail link. */
export const hrefOk = (v: string) => internalHrefOk(v) || externalHrefOk(v);
export const href = (label = "Link") => z.string().trim().min(1, `${label} is required`).max(300).refine(hrefOk, `${label} must start with / or # , or be a full https:// or mailto: address`).meta({ kind: "href", label });
/** A link target that may be empty; empty means "the default for this spot" (for example the site's contact e-mail). */
export const hrefOpt = (label = "Link") => z.string().trim().max(300).refine((v) => v === "" || hrefOk(v), `${label} must start with / or # , or be a full https:// or mailto: address`).meta({ kind: "href", label, optional: true });

/** A named part of a section: shown as a box around its fields. Make it optional with `.nullable()` (stored as null when switched off). */
export const group = <S extends z.ZodRawShape>(label: string, shape: S) => z.strictObject(shape).meta({ kind: "group", label });

/** A button or text link: its words and where it goes. */
export const link = (label: string, max = 28) => group(label, { label: text("Text", max), href: href("Link") });
/** A button whose target may be left empty to use the default. */
export const linkOpt = (label: string, max = 28) => group(label, { label: text("Text", max), href: hrefOpt("Link") });

/** The id of a row in the media library (`media_...`). The row itself is checked when a section is saved (see store.ts and page_section_refs). */
export const mediaId = (label = "Image") => z.string().trim().min(1, `${label} is required`).max(80).regex(/^[A-Za-z0-9_-]+$/, `${label}: not a media id`);

/**
 * A picture or video from the media library, as a section uses it: the file's id, and the text that describes it on this page.
 * Never a URL: the address, size, type and focal point come from the media row when the page is drawn. An empty `alt` means the picture is
 * decoration (`alt=""`), which is what the design has for almost every picture. Optional pictures are `.nullable()`.
 */
export const mediaRef = (label = "Image", kind: "image" | "video" = "image") =>
  z.strictObject({ id: mediaId(label), alt: optText(`${label} description`, 200) }).meta({ kind: "media", label, media: kind });
export type MediaReference = z.infer<ReturnType<typeof mediaRef>>;
/** The id of a case study. */
export const caseId = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/, "Not a case study id");

export const hexColour = z.string().trim().regex(/^(#[0-9a-fA-F]{6})?$/, "A colour like #ffb86b, or empty").meta({ kind: "colour", label: "Dot colour (optional)" });

/** One of a fixed set of choices; `options` gives the words shown for each value. */
export const choice = <const T extends readonly [string, ...string[]]>(label: string, values: T, options: Record<T[number], string>) => z.enum(values).meta({ kind: "select", label, options });
/** A yes/no switch. */
export const toggle = (label: string, textOn: string) => z.boolean().meta({ kind: "bool", label, text: textOn });

/** A list with the number of items the design takes; `noun` is what one item is called ("reason" gives "Reason 1", "Reason 2"). */
export const list = <T extends z.ZodType>(item: T, label: string, min: number, max: number, noun = "item") =>
  z.array(item).min(min, `${label}: add at least ${min}`).max(max, `${label}: at most ${max}`).meta({ kind: "list", label, noun } as Meta);
/** A list whose length the layout fixes (a 3-column grid, four clocks, ...): the editor shows no Add or Remove. */
export const fixedList = <T extends z.ZodType>(item: T, label: string, n: number, noun = "item") =>
  z.array(item).min(n, `${label}: add at least ${n}`).max(n, `${label}: at most ${n}`).meta({ kind: "list", label, noun, fixed: true } as Meta);
/** A list of case study ids, in order: no duplicates. */
export const caseIds = (label: string, min: number, max: number) =>
  z.array(caseId).min(min, `${label}: add at least ${min}`).max(max, `${label}: at most ${max}`).refine((v) => new Set(v).size === v.length, `${label}: a case study can be chosen once`).meta({ kind: "cases", label });

/** An IANA time zone name, checked by the runtime that will use it. */
export const timeZone = z.string().trim().min(1).max(60).refine((v) => {
  try { new Intl.DateTimeFormat("en", { timeZone: v }); return true; } catch { return false; }
}, "Not a known time zone (for example Europe/Lisbon)").meta({ kind: "timezone", label: "Time zone", hint: "For example Europe/Lisbon." });

/** The `{email}` placeholder in a text is replaced by the site's contact e-mail when the page is drawn. */
export const EMAIL_TOKEN = "{email}";
