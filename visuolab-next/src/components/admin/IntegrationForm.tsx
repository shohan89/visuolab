"use client";

import { useActionState } from "react";
import { saveIntegrationAction, type IntegrationFormState } from "@/actions/integrations";
import { EVENTS, type FieldDef } from "@/lib/integrations/core";
import { Err, Section, Text } from "./FormParts";

/**
 * The settings form of one integration, drawn from its field list in the catalog, so every integration (and any added later) gets the same
 * form. It holds the on/off switch and public-safe settings only. Keys, tokens and webhook addresses are Cloudflare secrets: there is
 * no field for them here, by design.
 */
export default function IntegrationForm({ slug, label, fields, enabled, config }: { slug: string; label: string; fields: FieldDef[]; enabled: boolean; config: Record<string, unknown> }) {
  const [state, run, pending] = useActionState<IntegrationFormState, FormData>(saveIntegrationAction, undefined);
  const v = (state?.values ?? { ...config, enabled }) as Record<string, unknown>;
  const errors = state?.errors ?? {};
  const n = Object.keys(errors).length;
  return (
    <form action={run} key={state?.nonce ?? 0} className="svc-form" noValidate>
      <input type="hidden" name="slug" value={slug} />
      {n > 0 && (
        <div className="form-errors" role="alert">
          <b>{n === 1 ? "One thing needs fixing" : `${n} things need fixing`} before this can be saved:</b>
          <ul>{Object.values(errors).map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
      <Section title="Settings" hint="Stored with the website's settings. Nothing secret goes here.">
        <div>
          <label className="check"><input type="checkbox" name="enabled" defaultChecked={v.enabled === true} /> {label} is switched on</label>
          <p className="hint">Switched off, nothing is sent or loaded. The settings below are kept.</p>
        </div>
        {fields.map((f) => {
          const value = v[f.name];
          if (f.type === "text") return <Text key={f.name} name={f.name} label={f.label} defaultValue={String(value ?? "")} max={f.max} errors={errors} hint={[f.placeholder, f.hint].filter(Boolean).join(" — ") || undefined} />;
          if (f.type === "emails") return <Text key={f.name} name={f.name} label={f.label} rows={3} defaultValue={Array.isArray(value) ? value.join("\n") : String(value ?? "")} max={600} errors={errors} hint={f.hint} />;
          if (f.type === "select") {
            return (
              <div className={errors[f.name] ? "field has-err" : "field"} key={f.name}>
                <label htmlFor={`f-${f.name}`}>{f.label}</label>
                <select id={`f-${f.name}`} name={f.name} defaultValue={String(value ?? f.options[0]?.value)}>
                  {f.options.map((o) => <option value={o.value} key={o.value}>{o.label}</option>)}
                </select>
                {f.hint && <p className="hint">{f.hint}</p>}
                <Err errors={errors} k={f.name} />
              </div>
            );
          }
          const on = Array.isArray(value) ? (value as string[]) : [];
          return (
            <fieldset className={errors[f.name] ? "field has-err" : "field"} key={f.name}>
              <legend>{f.label}</legend>
              {EVENTS.map((e) => <label className="check" key={e.id}><input type="checkbox" name={f.name} value={e.id} defaultChecked={on.includes(e.id)} /> {e.label}</label>)}
              {f.hint && <p className="hint">{f.hint}</p>}
              <Err errors={errors} k={f.name} />
            </fieldset>
          );
        })}
      </Section>
      <div className="savebar">
        <button type="submit" className="primary" disabled={pending}>{pending ? "Saving…" : `Save ${label}`}</button>
        <span className="hint">Changes take effect as soon as you save.</span>
      </div>
    </form>
  );
}
