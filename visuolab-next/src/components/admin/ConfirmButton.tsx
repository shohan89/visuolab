"use client";

import type { ReactNode } from "react";

/** A submit button that asks first. The form's server action only runs if the answer is yes. */
export default function ConfirmButton({ message, children }: { message: string; children: ReactNode }) {
  return (
    <button type="submit" className="danger" onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
