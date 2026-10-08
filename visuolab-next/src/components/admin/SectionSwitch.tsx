"use client";

import { useId, useRef } from "react";

/**
 * The enabled / disabled switch of a section. Turning a section on, or off when it is an ordinary one, submits straight away. Turning off an
 * important section opens a confirmation first that says what visitors will lose; the form then carries `confirm=1`, which the server requires
 * (without it the section stays on). The section's content is never deleted: it stays stored and can be switched on again.
 */
export default function SectionSwitch({ action, fields, enabled, name, confirm }: {
  action: (f: FormData) => void | Promise<void>;
  /** Hidden fields that say which section (template + key, or kind + id + key). */
  fields: Record<string, string>;
  enabled: boolean;
  name: string;
  /** Present for important sections: what is lost when it is switched off. */
  confirm?: string;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const needsConfirm = enabled && !!confirm;

  return (
    <form action={action} ref={form} className="sc-switch">
      {Object.entries(fields).map(([k, v]) => <input type="hidden" name={k} value={v} key={k} />)}
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      {needsConfirm && <input type="hidden" name="confirm" value="1" />}
      <button
        type={needsConfirm ? "button" : "submit"} className="switch" role="switch" aria-checked={enabled}
        aria-label={`${name}: ${enabled ? "shown on the website, click to hide" : "hidden, click to show"}`}
        onClick={needsConfirm ? () => dialog.current?.showModal() : undefined}
      ><span aria-hidden="true" /></button>
      <span className={enabled ? "badge published" : "badge draft"}>{enabled ? "Enabled" : "Disabled"}</span>
      {needsConfirm && (
        <dialog ref={dialog} className="confirm-dialog" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
          <h2 id={`${id}-t`}>Switch off “{name}”?</h2>
          <p id={`${id}-d`}>{confirm}</p>
          <p className="hint">Nothing is deleted. The section stays stored and you can switch it on again at any time.</p>
          <div className="confirm-actions">
            <button type="button" onClick={() => dialog.current?.close()} autoFocus>Keep it on</button>
            <button type="submit" className="danger">Switch off</button>
          </div>
        </dialog>
      )}
    </form>
  );
}
