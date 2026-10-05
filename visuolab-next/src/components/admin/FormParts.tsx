"use client";

import { useState, type ReactNode } from "react";
import type { MediaOption } from "@/lib/server/services-admin";
import { MediaField } from "./MediaPicker";

export function Err({ errors, k }: { errors: Record<string, string>; k: string }) {
  return errors[k] ? <p className="field-err" id={`err-${k}`}>{errors[k]}</p> : null;
}

/** A text field with a live character count against its limit. */
export function Text({ name, label, defaultValue, max, rows, errors, hint, required, recommended }: {
  name: string; label: string; defaultValue: string; max: number; rows?: number; errors: Record<string, string>; hint?: ReactNode; required?: boolean; recommended?: number;
}) {
  const [len, setLen] = useState(defaultValue.length);
  const bad = !!errors[name];
  const common = { id: `f-${name}`, name, defaultValue, maxLength: max + 40, required, "aria-invalid": bad || undefined, "aria-describedby": bad ? `err-${name}` : undefined } as const;
  return (
    <div className={bad ? "field has-err" : "field"}>
      <label htmlFor={`f-${name}`}>{label}</label>
      {rows ? <textarea {...common} rows={rows} onInput={(e) => setLen(e.currentTarget.value.length)} /> : <input {...common} type="text" onInput={(e) => setLen(e.currentTarget.value.length)} />}
      <p className="hint"><span className={len > max || (recommended && len > recommended) ? "over" : ""}>{len}/{recommended ?? max}</span>{hint ? <> · {hint}</> : null}</p>
      <Err errors={errors} k={name} />
    </div>
  );
}

export function MediaSelect({ name, altName, label, value, alt, media, errors }: { name: string; altName: string; label: string; value: string; alt: string; media: MediaOption[]; errors: Record<string, string> }) {
  return (
    <div className={errors[name] ? "field has-err media-pick" : "field media-pick"}>
      <span className="label-like" id={`l-${name}`}>{label}</span>
      <MediaField name={name} id={`f-${name}`} value={value} known={media} label={label} />
      <Err errors={errors} k={name} />
      <label htmlFor={`f-${altName}`} className="sub">Description for screen readers (leave empty if the image is only decoration)</label>
      <input id={`f-${altName}`} name={altName} type="text" defaultValue={alt} maxLength={240} />
      <Err errors={errors} k={altName} />
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="form-card">
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

