"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const Icon = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 24 24">{children}</svg>;
const COPY = (
  <Icon>
    <rect x="9" y="9" width="12" height="12" rx="2.4" />
    <path d="M15 9V5.4A2.4 2.4 0 0012.6 3H5.4A2.4 2.4 0 003 5.4v7.2A2.4 2.4 0 005.4 15H9" />
  </Icon>
);
const CHECK = <Icon><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;

/**
 * "Share" rail (sticky, right of the article): X, LinkedIn, Facebook and a copy-link button, as built by the original script.
 * The links are plain anchors (they work without JavaScript); only the copy button needs the client.
 * Like the original script, both the share links and the copied text use the article address without any #section.
 */
export default function ShareRail({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const u = encodeURIComponent(url);
  const nets = [
    { label: "Share on X", href: `https://twitter.com/intent/tweet?url=${u}&text=${encodeURIComponent(title)}`, icon: <Icon><path d="M5 5l14 14M19 5L5 19" /></Icon> },
    {
      label: "Share on LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      icon: <Icon><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10v7M8 7v.5M12 17v-4a2 2 0 014 0v4" /></Icon>,
    },
    {
      label: "Share on Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      icon: <Icon><path d="M14 8.5h2.5V5.2h-2.6c-2 0-3.4 1.4-3.4 3.5v1.8H8v3.3h2.5V21h3.4v-7.2h2.4l.4-3.3h-2.8V9.2c0-.5.3-.7.7-.7z" /></Icon>,
    },
  ];

  return (
    <aside className="share" aria-label="Share this article">
      <p className="rail-label">Share</p>
      <div className="share-btns">
        {nets.map((n) => (
          <a href={n.href} target="_blank" rel="noopener" aria-label={n.label} title={n.label} key={n.label}>{n.icon}</a>
        ))}
        <button
          type="button"
          className={copied ? "copied" : undefined}
          aria-label="Copy link"
          title="Copy link"
          onClick={() => {
            if (!navigator.clipboard) return;
            navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setCopied(false), 1600);
            }, () => {});
          }}
        >
          {copied ? CHECK : COPY}
        </button>
      </div>
    </aside>
  );
}
