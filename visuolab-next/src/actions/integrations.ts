"use server";

import { redirect } from "next/navigation";
import { catalogEntry, parseConfig, type FieldDef } from "@/lib/integrations/core";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { saveIntegration, testIntegration } from "@/lib/server/integrations";
import { countHit } from "@/lib/server/rate-limit";
import { ipHash, requestHeaders, strictSameOrigin } from "@/lib/server/request";

/** Same two checks as every admin action: the request comes from this site, and the session belongs to an admin. */
async function guard() {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  const admin = await requireAdmin();
  return { admin, h };
}

export type IntegrationFormState = { errors: Record<string, string>; values?: Record<string, unknown>; nonce: number } | undefined;

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

/** What one field of the generic form sends, as the schema expects it. */
function readField(f: FormData, field: FieldDef): unknown {
  switch (field.type) {
    case "events": return f.getAll(field.name).map(String);
    case "emails": return text(f, field.name).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    default: return text(f, field.name);
  }
}

/** Saves the switch and the settings of one integration. Secrets are not part of this form: they are Cloudflare secrets. */
export async function saveIntegrationAction(_prev: IntegrationFormState, f: FormData): Promise<IntegrationFormState> {
  const { admin, h } = await guard();
  const def = catalogEntry(text(f, "slug"));
  if (!def) redirect("/admin/integrations");
  const enabled = f.get("enabled") === "on";
  const raw = Object.fromEntries(def.fields.map((x) => [x.name, readField(f, x)]));
  const parsed = parseConfig(def, raw);
  if (!parsed.ok) {
    // field errors keep what was typed; the toggle stays as sent
    return { errors: parsed.errors, values: { ...raw, enabled }, nonce: Date.now() + Math.random() };
  }
  const changed = await saveIntegration(def.slug, enabled, parsed.config, admin.id);
  await audit({
    action: "integration.update", userId: admin.id, userEmail: admin.email, entityType: "integration", entityId: def.slug,
    summary: changed.length ? `${def.label}: changed ${changed.join(", ")}` : `${def.label}: saved, nothing changed`, ipHash: await ipHash(h),
  });
  redirect(`/admin/integrations/${def.slug}?n=saved`);
}

/** Runs the integration's own check from the server. At most 10 per 10 minutes per admin. The reason for a failure is in the activity list. */
export async function testIntegrationAction(f: FormData): Promise<void> {
  const { admin, h } = await guard();
  const def = catalogEntry(text(f, "slug"));
  if (!def) redirect("/admin/integrations");
  const back = `/admin/integrations/${def.slug}`;
  if ((await countHit(getDb(), `integration-test:${admin.id}`, 600)) > 10) redirect(`${back}?n=test_limited`);
  const r = await testIntegration(def.slug);
  await audit({ action: "integration.test", userId: admin.id, userEmail: admin.email, entityType: "integration", entityId: def.slug, summary: `${def.label}: test ${r.ok ? "passed" : "did not pass"}`, ipHash: await ipHash(h) });
  redirect(`${back}?n=${r.ok ? "itest_ok" : r.message.startsWith("Not tested") || r.message.startsWith("Not sent") ? "itest_not_ready" : "itest_failed"}`);
}
