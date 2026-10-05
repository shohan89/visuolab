"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Kind = "success" | "error" | "info";
type Toast = { id: number; kind: Kind; text: string };
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

/** Messages a server action asks for by code (?n=...) after it redirects. Codes, not text, so a link cannot show arbitrary words. */
const NOTICES: Record<string, { kind: Kind; text: string }> = {
  status: { kind: "success", text: "Status updated." },
  deleted: { kind: "success", text: "Submission deleted." },
  saved: { kind: "success", text: "Saved." },
  created: { kind: "success", text: "Created." },
  published: { kind: "success", text: "Published. The page is live." },
  unpublished: { kind: "success", text: "Taken off the website." },
  removed: { kind: "success", text: "Deleted." },
  featured: { kind: "success", text: "Marked as featured." },
  unfeatured: { kind: "success", text: "No longer featured." },
  moved: { kind: "success", text: "Order updated." },
  cannot_publish: { kind: "error", text: "Not published: finish the missing fields first, then try again." },
  confirm_needed: { kind: "error", text: "Not done: the slug did not match. Nothing was changed." },
  failed: { kind: "error", text: "That did not work. Please try again." },
};

export const useToast = () => useContext(Ctx);

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (text: string, kind: Kind = "info") => {
      const id = next.current++;
      setToasts((t) => [...t.slice(-3), { id, kind, text }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 8000 : 4500);
    },
    [dismiss],
  );

  // show the message a server action asked for, then remove it from the address bar. The provider stays mounted
  // between pages, so this watches the address instead of running once.
  const code = useSearchParams().get("n");
  const router = useRouter();
  useEffect(() => {
    if (!code) return;
    const url = new URL(window.location.href);
    const n = NOTICES[code];
    if (n) push(n.text, n.kind);
    url.searchParams.delete("n");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    router.refresh(); // the sidebar count lives in the layout, which a page-to-page move does not reload
  }, [code, push, router]);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => (
          <div className={`toast ${t.kind}`} role={t.kind === "error" ? "alert" : "status"} key={t.id}>
            <span>{t.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
