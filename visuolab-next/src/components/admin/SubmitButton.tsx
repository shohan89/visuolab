"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/** A submit button that disables itself and shows progress while its server action runs. With `confirm`, asks first. */
export default function SubmitButton({ children, className, confirm }: { children: ReactNode; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
