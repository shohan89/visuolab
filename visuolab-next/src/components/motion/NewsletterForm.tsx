"use client";

import type { ReactNode } from "react";

/** The footer newsletter form. The original was a design only (onsubmit="return false"); wiring comes later. */
export default function NewsletterForm({ children }: { children: ReactNode }) {
  return <form onSubmit={(e) => e.preventDefault()}>{children}</form>;
}
