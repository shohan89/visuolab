"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { saveSection } from "@/lib/server/navigation-admin";
import { ipHash, requestHeaders, strictSameOrigin } from "@/lib/server/request";
import { SECTIONS, type SectionKey } from "@/lib/navigation/config";
import { readItems, validateSection, type NavErrors } from "@/lib/validation/navigation";

/** `nonce` is new on every answer, so the editor knows to show the returned errors again. */
export type NavFormState = { errors: NavErrors; nonce: number } | undefined;
const fail = (errors: NavErrors): NavFormState => ({ errors, nonce: Date.now() + Math.random() });

/** Saves one section (header or footer) as a whole. Same two checks as every admin action: the request comes from this site, and the session belongs to an admin. */
export async function saveNavigation(_prev: NavFormState, f: FormData): Promise<NavFormState> {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  const admin = await requireAdmin();

  const section = String(f.get("section") ?? "") as SectionKey;
  if (!(section in SECTIONS)) return fail({ form: "Unknown menu." });
  let raw: unknown;
  try {
    raw = JSON.parse(String(f.get("items") ?? ""));
  } catch {
    return fail({ form: "The menu could not be read. Reload the page and try again." });
  }
  const items = readItems(raw);
  if (!items) return fail({ form: "The menu could not be read. Reload the page and try again." });
  const checked = validateSection(section, items);
  if (!checked.ok) return fail(checked.errors);

  const res = await saveSection(section, checked.items);
  if (!res.ok) return fail({ form: res.error });
  const parts = [res.added && `${res.added} added`, res.removed && `${res.removed} deleted`, res.changed && `${res.changed} edited`, res.reordered && "reordered"].filter(Boolean);
  await audit({
    action: "navigation.update", userId: admin.id, userEmail: admin.email, entityType: "navigation", entityId: section,
    summary: `${SECTIONS[section].title}: ${parts.length ? parts.join(", ") : "saved, nothing changed"}`, ipHash: await ipHash(h),
  });
  redirect("/admin/navigation?n=saved");
}
