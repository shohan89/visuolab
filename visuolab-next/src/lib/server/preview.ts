import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { PageTemplate } from "@/lib/cms/types";
import { getAdmin } from "./auth";

/*
 * Preview of draft content on the real public pages. A public route called with `?preview=1` calls enterPreview(): without an admin session the visitor
 * is sent to the sign-in page (nothing about the draft is revealed); with one, the rest of the request draws the DRAFT content through the very same
 * components and styles as the live page. The flag is per request (React cache), so components deep in the tree that load their own content (getPage,
 * the record loaders) see it too. A preview is never cached: the worker skips its page cache for requests with a query string or a session.
 */
const state = cache(() => ({ on: false }));

/** Is this request a preview by a signed-in admin? */
export const isPreview = () => state().on;

type SearchParams = Record<string, string | string[] | undefined> | undefined;

/** Call first in a public route with its `searchParams`. Returns true when the request is an admin's preview. */
export async function enterPreview(searchParams: SearchParams): Promise<boolean> {
  if (!searchParams?.preview) return false;
  if (!(await getAdmin())) redirect("/admin/login");
  state().on = true;
  return true;
}

/** A page that is a draft (unpublished) answers "not found" to visitors; a signed-in admin still sees it (that is how it is previewed). */
export async function requirePublished(template: PageTemplate, status: string | undefined): Promise<void> {
  if (!status || status === "published") return;
  if (state().on || (await getAdmin())) return;
  notFound();
}
