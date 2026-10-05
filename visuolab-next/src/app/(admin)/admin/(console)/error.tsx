"use client";

import { useEffect } from "react";

/** Shown when an admin page fails to load. Details stay in the server log; the screen shows only a reference code. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("admin page error", error.digest ?? "");
  }, [error]);
  return (
    <div className="empty-state error-state" role="alert">
      <b>Something went wrong</b>
      <p>This page could not be loaded. Try again, and if it keeps happening tell the developer{error.digest ? ` (reference ${error.digest})` : ""}.</p>
      <button type="button" className="primary" onClick={reset}>Try again</button>
    </div>
  );
}
