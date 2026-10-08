/*
 * Builds the editor form of a section type from its strict Zod schema. Nothing about a form is written by hand: the fields, their order, which
 * control edits each one (text, text area, rich text, link, media picker, select, switch, repeater, case study picker), the limits (maximum length,
 * how many items) and whether a field is optional all come from the schema and the small metadata the schema blocks carry (primitives.ts).
 * The result is plain data (fields.ts types), so the server can hand it to the editor in the browser.
 *
 * Reads Zod's own description of a schema, so a schema that changes shape changes its form; verify-pages.mjs checks that the form built for each
 * section fits the section's current content exactly.
 */
import { z } from "zod";
import { SECTION_TYPES } from "./registry.ts";
import type { FieldDef } from "./fields.ts";
import type { SectionType } from "./types.ts";

type Check = { _zod: { def: { check: string; maximum?: number; minimum?: number } } };
type Def = { type: string; shape?: Record<string, z.ZodType>; element?: z.ZodType; innerType?: z.ZodType; entries?: Record<string, unknown>; checks?: Check[] };
type Meta = { kind?: string; label?: string; hint?: string; optional?: boolean; media?: "image" | "video"; options?: Record<string, string>; text?: string; noun?: string; fixed?: boolean; lines?: boolean };

const def = (s: z.ZodType): Def => (s as unknown as { _zod: { def: Def } })._zod.def;
const meta = (s: z.ZodType): Meta => (z.globalRegistry.get(s) ?? {}) as Meta;
const limit = (s: z.ZodType, check: "max_length" | "min_length"): number | undefined => {
  const c = def(s).checks?.find((x) => x._zod.def.check === check)?._zod.def;
  return check === "max_length" ? c?.maximum : c?.minimum;
};

/** "primaryCta" -> "Primary cta": only used when a schema block has no label. */
const humanize = (key: string) => { const w = key.replace(/([A-Z])/g, " $1").trim().toLowerCase(); return w ? w[0]!.toUpperCase() + w.slice(1) : ""; };

const textRows = (max: number) => (max >= 250 ? 5 : max >= 140 ? 3 : max >= 100 ? 2 : undefined);
const richRows = (max: number) => (max >= 300 ? 6 : undefined);

function node(schema: z.ZodType, key: string): FieldDef {
  let s = schema;
  let nullable = false;
  while (def(s).type === "nullable" || def(s).type === "optional") { nullable = true; s = def(s).innerType!; }
  const m: Meta = { ...meta(s), ...meta(schema) };
  const base = { key, label: m.label ?? humanize(key), ...(m.hint ? { hint: m.hint } : {}) };
  const t = def(s).type;

  if (t === "string") {
    const kind = m.kind ?? "text";
    const max = limit(s, "max_length") ?? 200;
    if (kind === "rich") return { ...base, kind: "rich", max, ...(richRows(max) ? { rows: richRows(max) } : {}), ...(m.lines ? { lines: true } : {}) };
    if (kind === "href") return { ...base, kind: "href", ...(m.optional ? { optional: true } : {}) };
    if (kind === "colour") return { ...base, kind: "colour" };
    if (kind === "timezone") return { ...base, kind: "timezone" };
    return { ...base, kind: "text", max, ...(textRows(max) ? { rows: textRows(max) } : {}), ...((limit(s, "min_length") ?? 0) < 1 ? { optional: true } : {}) };
  }
  if (t === "enum") return { ...base, kind: "select", options: Object.keys(def(s).entries ?? {}).map((v) => ({ value: v, label: m.options?.[v] ?? v })) };
  if (t === "boolean") return { ...base, kind: "bool", text: m.text ?? base.label };
  if (t === "object") {
    if (m.kind === "media") return { ...base, kind: "media", media: m.media ?? "image", ...(nullable ? { optional: true } : {}) };
    return { ...base, kind: "group", fields: Object.entries(def(s).shape ?? {}).map(([k, v]) => node(v, k)), ...(nullable ? { optional: true } : {}) };
  }
  if (t === "array") {
    const min = limit(s, "min_length") ?? 0;
    const max = limit(s, "max_length") ?? 99;
    if (m.kind === "cases") return { ...base, kind: "cases", min, max };
    const element = def(s).element!;
    const el = def(element);
    const plainObject = el.type === "object" && meta(element).kind !== "media";
    return { ...base, kind: "list", noun: m.noun ?? "item", min, max, ...(m.fixed ? { fixed: true } : {}), of: plainObject ? { fields: Object.entries(el.shape ?? {}).map(([k, v]) => node(v, k)) } : { leaf: node(element, "") } };
  }
  throw new Error(`describe: no control for a ${t} field (${key})`);
}

const memo = new Map<SectionType, readonly FieldDef[]>();

/** The editor form of a section type: its fields in schema order. */
export function fieldsFor(type: SectionType): readonly FieldDef[] {
  const hit = memo.get(type);
  if (hit) return hit;
  const schema = SECTION_TYPES[type].schema as unknown as z.ZodType;
  const fields = Object.entries(def(schema).shape ?? {}).map(([k, v]) => node(v, k));
  memo.set(type, fields);
  return fields;
}
