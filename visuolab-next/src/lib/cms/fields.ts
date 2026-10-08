/*
 * The shape of an editor form: a tree of fields, each with the control that edits it. The tree is not written by hand: describe.ts builds it from
 * the strict schema of the section type (src/lib/cms/sections/*), so a field is in the form because it is in the schema, with its limits read from
 * the schema. This file holds only the types and the helpers the editor (browser) needs, with no imports of the schemas.
 */

export type Leaf = { key: string; label: string; hint?: string };

export type FieldDef =
  | (Leaf & { kind: "text"; max: number; /** more than one line: shown as a text area */ rows?: number; /** may be left empty */ optional?: boolean })
  | (Leaf & { kind: "rich"; max: number; rows?: number; /** a new line is a line break */ lines?: boolean })
  | (Leaf & { kind: "href"; /** may be left empty (the page then uses its default) */ optional?: boolean })
  | (Leaf & { kind: "media"; media: "image" | "video"; /** the picture may be left out */ optional?: boolean; /** no description field (an avatar) */ noAlt?: boolean })
  | (Leaf & { kind: "number"; min: number; max: number; /** may be left empty */ optional?: boolean })
  | (Leaf & { kind: "datetime" })
  | (Leaf & { kind: "select"; options: readonly { value: string; label: string }[] })
  | (Leaf & { kind: "bool"; text: string })
  | (Leaf & { kind: "colour" })
  | (Leaf & { kind: "timezone" })
  | (Leaf & { kind: "cases"; min: number; max: number })
  | (Leaf & { kind: "pick"; source: string; noun: string; min: number; max: number; /** one value, not a list */ single?: boolean })
  | (Leaf & { kind: "hidden"; fallback: unknown })
  | (Leaf & { kind: "blocks"; min: number; max: number })
  | (Leaf & { kind: "group"; fields: readonly FieldDef[]; /** the whole group may be switched off (stored as null) */ optional?: boolean })
  | (Leaf & { kind: "list"; noun: string; min: number; max: number; /** the layout fixes the count: no adding or removing */ fixed?: boolean; of: { fields: readonly FieldDef[] } | { leaf: FieldDef } });

/** A blank value for a field: what "Add" puts in a list. */
export function blank(f: FieldDef): unknown {
  switch (f.kind) {
    case "text": case "rich": case "href": case "colour": case "timezone": case "datetime": return "";
    case "number": return f.optional ? null : f.min;
    case "media": return f.noAlt ? { id: "" } : { id: "", alt: "" };
    case "select": return f.options[0]!.value;
    case "bool": return false;
    case "cases": case "blocks": return [];
    case "pick": return f.single ? "" : [];
    case "hidden": return f.fallback;
    case "group": return f.optional ? null : Object.fromEntries(f.fields.map((x) => [x.key, blank(x)]));
    case "list": return [];
  }
}

/** A blank list item. */
export const blankItem = (f: Extract<FieldDef, { kind: "list" }>): unknown => ("leaf" in f.of ? blank(f.of.leaf) : Object.fromEntries(f.of.fields.map((x) => [x.key, blank(x)])));
