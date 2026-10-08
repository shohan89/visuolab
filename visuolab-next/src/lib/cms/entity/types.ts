/*
 * Sections of the pages that come from a record: a service, a case study, an article.
 *
 * These pages are drawn by one component each, from one database row. The row already keeps each part of the page in its own column or JSON
 * document, so the sections are not stored a second time: a section here is a strict schema plus two small functions that read its content out of
 * the record and put edited content back. Saving a section changes that part of the record and nothing else, and the whole record is then checked
 * by the same schema as the full form, so a section save can never store what the full form would refuse.
 *
 * Relative imports with extensions on purpose: scripts/db/verify-entities.mjs loads these files in plain Node.
 */
import type { z } from "zod";

export type EntityKind = "service" | "case_study" | "blog_post";

export type EntitySection<I> = {
  /** The address segment (`/admin/case-studies/<id>/<key>`). Never `edit` or `confirm`. */
  key: string;
  /** What the editor calls it, in the order of the public page. */
  name: string;
  /** The kind of block, shown as a badge ("Image gallery"). */
  type: string;
  /** What the section is for, one sentence under the name. */
  about: string;
  /** The id of the block on the public page, when it has one. */
  anchor?: string;
  /** Strict schema of the content of this section. The editor form is built from it. */
  schema: z.ZodType;
  /** This section's content, out of the record. */
  read: (input: I) => unknown;
  /** The record with this section's content put in. Pure: returns a new record. */
  apply: (input: I, content: unknown) => I;
  /** An error of the whole-record check (keyed by the record's field path) as the path inside this section, or null when it belongs elsewhere. */
  mapError: (key: string) => string | null;
  /** Important sections: what visitors lose when it is switched off. The editor must confirm first (the server insists). */
  confirm?: string;
  /** Why this section cannot be switched off (it is not a block drawn on the page). */
  lock?: string;
  /** Sections that keep their own flag in the record (the two service sections that had a switch before). Others use entity_hidden_sections. */
  toggle?: { read: (input: I) => boolean; write: (input: I, on: boolean) => I };
};

/** Typed constructor: the schema decides the content type of `read` and `apply`. */
export function section<I, S extends z.ZodType>(def: {
  key: string; name: string; type: string; about: string; anchor?: string; schema: S;
  read: (input: I) => z.input<S>;
  apply: (input: I, content: z.output<S>) => I;
  map?: Record<string, string>;
  mapError?: (key: string) => string | null;
  confirm?: string;
  lock?: string;
  toggle?: { read: (input: I) => boolean; write: (input: I, on: boolean) => I };
}): EntitySection<I> {
  return {
    key: def.key, name: def.name, type: def.type, about: def.about, ...(def.anchor ? { anchor: def.anchor } : {}), schema: def.schema,
    read: def.read as (input: I) => unknown,
    apply: def.apply as (input: I, content: unknown) => I,
    mapError: def.mapError ?? remap(def.map ?? {}),
    ...(def.toggle ? { toggle: def.toggle } : {}),
    ...(def.confirm ? { confirm: def.confirm } : {}),
    ...(def.lock ? { lock: def.lock } : {}),
  };
}

/**
 * Maps a record error path to a section path by prefix: `{ process: "" }` turns `process.steps.0.text` into `steps.0.text`, `{ coverImage: "cover.id" }`
 * turns `coverImage` into `cover.id`. The longest matching prefix wins; a path with no match is not this section's (null).
 */
export function remap(map: Record<string, string>): (key: string) => string | null {
  const prefixes = Object.keys(map).sort((a, b) => b.length - a.length);
  return (key) => {
    for (const p of prefixes) {
      if (key === p) return map[p] || "form";
      if (key.startsWith(`${p}.`)) {
        const rest = key.slice(p.length + 1);
        return map[p] ? `${map[p]}.${rest}` : rest;
      }
    }
    return null;
  };
}

export const sectionOf = <I>(list: readonly EntitySection<I>[], key: string): EntitySection<I> | undefined => list.find((s) => s.key === key);
