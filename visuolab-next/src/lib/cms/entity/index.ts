/* The record-based pages and their sections: one list per kind, and what the admin needs to know about each kind. */
import { BLOG_SECTIONS } from "./blog.ts";
import { CASE_STUDY_SECTIONS } from "./case-study.ts";
import { SERVICE_SECTIONS } from "./service.ts";
import type { EntityKind, EntitySection } from "./types.ts";

export { BLOG_SECTIONS, CASE_STUDY_SECTIONS, SERVICE_SECTIONS };
export { remap, section, sectionOf } from "./types.ts";
export type { EntityKind, EntitySection } from "./types.ts";

export type EntityInfo = {
  kind: EntityKind;
  /** "service", "case study", "article" */
  noun: string;
  /** Where the admin screens live. */
  admin: string;
  /** The public address of a record, from its slug. */
  route: (slug: string) => string;
  /** The listing page that shows cards of these records. */
  listing: string;
  /** The `entity_type` written to the audit log. */
  auditType: string;
  sections: readonly EntitySection<never>[];
};

// The sections are typed by the record they edit; the registry only needs them as a list of keys, schemas and functions.
export const ENTITIES: Record<EntityKind, EntityInfo> = {
  service: { kind: "service", noun: "service", admin: "/admin/services", route: (s) => `/services/${s}`, listing: "/services", auditType: "service", sections: SERVICE_SECTIONS as unknown as readonly EntitySection<never>[] },
  case_study: { kind: "case_study", noun: "case study", admin: "/admin/case-studies", route: (s) => `/works/${s}`, listing: "/works", auditType: "case_study", sections: CASE_STUDY_SECTIONS as unknown as readonly EntitySection<never>[] },
  blog_post: { kind: "blog_post", noun: "article", admin: "/admin/blog", route: (s) => `/blog/${s}`, listing: "/blog", auditType: "blog_post", sections: BLOG_SECTIONS as unknown as readonly EntitySection<never>[] },
};
