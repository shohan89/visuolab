"use client";

import { useId, useRef } from "react";

/**
 * A button that asks first. Used for actions with consequences for visitors (unpublishing). It opens a dialog that says what will happen; "Yes" submits
 * the form with `confirm=1`, which the server requires; "Keep it as it is" closes the dialog and changes nothing.
 */
export default function ConfirmSubmit({ action, fields, label, title, text, yes, className }: {
  action: (f: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: string;
  title: string;
  text: string;
  yes: string;
  className?: string;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <form action={action} className="confirm-form">
      {Object.entries(fields).map(([k, v]) => <input type="hidden" name={k} value={v} key={k} />)}
      <input type="hidden" name="confirm" value="1" />
      <button type="button" className={className ?? "btn"} onClick={() => dialog.current?.showModal()}>{label}</button>
      <dialog ref={dialog} className="confirm-dialog" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
        <h2 id={`${id}-t`}>{title}</h2>
        <p id={`${id}-d`}>{text}</p>
        <div className="confirm-actions">
          <button type="button" onClick={() => dialog.current?.close()} autoFocus>Keep it as it is</button>
          <button type="submit" className="danger">{yes}</button>
        </div>
      </dialog>
    </form>
  );
}
