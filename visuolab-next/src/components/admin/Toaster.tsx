"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

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
  scheduled: { kind: "success", text: "Scheduled. It goes live at its publish time." },
  in_use: { kind: "error", text: "Not changed: articles still use it. Move them first." },
  exists: { kind: "error", text: "That name or slug is already taken." },
  invalid: { kind: "error", text: "Check the name: 2 or more characters, no < or >." },
  media_in_use: { kind: "error", text: "Not deleted: this file is still used. Replace it where it is used first." },
  static_media: { kind: "error", text: "This file ships with the website and cannot be deleted here. You can replace it." },
  invalid_media: { kind: "error", text: "Check the fields: a title is required and < > are not allowed." },
  test_sent: { kind: "success", text: "Test email sent. Check the inbox of the notification address." },
  test_disabled: { kind: "error", text: "Test not sent: email notifications are switched off." },
  test_no_key: { kind: "error", text: "Test not sent: the Resend API key (RESEND_API_KEY) is not set as a Cloudflare secret." },
  test_no_recipient: { kind: "error", text: "Test not sent: add a sender and at least one notification address first." },
  test_failed: { kind: "error", text: "The email provider refused the test. Check the sender address and the key." },
  test_limited: { kind: "error", text: "Too many tests. Try again in a few minutes." },
  itest_ok: { kind: "success", text: "Test passed." },
  itest_failed: { kind: "error", text: "The test failed. The reason is in the Activity list below." },
  itest_not_ready: { kind: "error", text: "Not tested: finish the configuration first. The Status box says what is missing." },
  notify_sent: { kind: "success", text: "Notification sent." },
  notify_failed: { kind: "error", text: "The notification could not be sent. The reason is shown on the enquiry." },
  notify_skipped: { kind: "error", text: "No notification was sent. The reason is shown on the enquiry." },
  moved: { kind: "success", text: "Order updated." },
  cannot_publish: { kind: "error", text: "Not published: finish the missing fields first, then try again." },
  confirm_needed: { kind: "error", text: "Not done: the slug did not match. Nothing was changed." },
  section_shown: { kind: "success", text: "Section shown on the website." },
  section_hidden: { kind: "success", text: "Section hidden. Its content is kept." },
  section_incomplete: { kind: "error", text: "Not shown: finish the fields of that section first, then try again." },
  draft_saved: { kind: "success", text: "Saved as a draft. Visitors still see the published version." },
  changes_published: { kind: "success", text: "Published. The changes are live." },
  publish_failed: { kind: "error", text: "Some changes could not be published; they are still drafts. Open the sections marked Draft to see why." },
  nothing_to_publish: { kind: "info", text: "There are no unpublished changes." },
  draft_discarded: { kind: "success", text: "Draft changes discarded. The published version is unchanged." },
  page_unpublished: { kind: "success", text: "Page unpublished. Visitors get a not-found page; you can still preview it." },
  page_published: { kind: "success", text: "Page published." },
  page_locked: { kind: "error", text: "This page cannot be unpublished: the website needs its front page." },
  section_confirm: { kind: "error", text: "Not hidden: this is an important section and needs your confirmation. Nothing was changed." },
  section_locked: { kind: "error", text: "This section cannot be hidden: other pages link to it." },
  failed: { kind: "error", text: "That did not work. Please try again." },
};

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
