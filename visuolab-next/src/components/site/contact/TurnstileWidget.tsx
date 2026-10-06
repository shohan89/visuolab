"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile for the contact form. Rendered only when the integration is switched on and fully configured (the server decides),
 * so with it off the form is exactly as designed. The widget runs in "interaction-only" mode: nothing is shown unless Cloudflare needs the
 * visitor to do something. Cloudflare puts the proof into a hidden field named cf-turnstile-response inside the form; the server verifies it
 * with the secret key. The site key is public by design. A proof can be used once, so `resetKey` asks for a new one after a failed send.
 */
type TurnstileApi = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id?: string) => void };
declare global {
  interface Window { turnstile?: TurnstileApi; __tsLoading?: Promise<void> }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  window.__tsLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script blocked"));
    document.head.appendChild(s);
  });
  return window.__tsLoading;
}

export default function TurnstileWidget({ siteKey, resetKey }: { siteKey: string; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | undefined>(undefined);

  useEffect(() => {
    let gone = false;
    load()
      .then(() => {
        if (gone || !box.current || !window.turnstile || id.current) return;
        id.current = window.turnstile.render(box.current, { sitekey: siteKey, appearance: "interaction-only", theme: "auto" });
      })
      .catch(() => { /* blocked: the form still sends; the server decides what a missing proof means */ });
    return () => { gone = true; if (id.current) window.turnstile?.remove(id.current); id.current = undefined; };
  }, [siteKey]);

  useEffect(() => { if (resetKey > 0 && id.current) window.turnstile?.reset(id.current); }, [resetKey]);

  return <div ref={box} data-turnstile />;
}
