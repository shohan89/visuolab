"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Breadcrumbs from "./Breadcrumbs";

type NavItem = { href: string; label: string };
const GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [{ href: "/admin", label: "Dashboard" }] },
  { title: "Inbox", items: [{ href: "/admin/submissions", label: "Submissions" }] },
  { title: "Content", items: [{ href: "/admin/services", label: "Services" }, { href: "/admin/case-studies", label: "Case studies" }, { href: "/admin/blog", label: "Blog" }, { href: "/admin/media", label: "Media" }, { href: "/admin/pages", label: "Pages" }, { href: "/admin/revisions", label: "Recent changes" }] },
  { title: "Site", items: [{ href: "/admin/navigation", label: "Navigation" }, { href: "/admin/integrations", label: "Integrations" }, { href: "/admin/settings", label: "Settings" }] },
];

type Props = { user: { name: string; email: string; role: string }; newCount: number; signOut: () => Promise<void>; children: ReactNode };

/** Sidebar, top bar (breadcrumbs, account menu) and the content area. Holds navigation state only; the only data it gets is the signed-in user. */
export default function AdminChrome({ user, newCount, signOut, children }: Props) {
  const pathname = usePathname() ?? "/admin";
  const [openAt, setOpenAt] = useState<string | null>(null); // the page the mobile menu was opened on; moving to another page closes it
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpenAt(null); menu.current?.removeAttribute("open"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/"));
  const initials = (user.name || user.email).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className={open ? "shell is-open" : "shell"}>
      <aside className="side" id="admin-side" aria-label="Admin sections">
        <Link href="/admin" prefetch={false} className="side-brand">Visuolab <small>admin</small></Link>
        <nav>
          {GROUPS.map((g) => (
            <div className="side-group" key={g.title}>
              <p>{g.title}</p>
              {g.items.map((it) => (
                <Link href={it.href} prefetch={false} key={it.label} aria-current={active(it.href) ? "page" : undefined}>
                  {it.label}
                  {it.href === "/admin/submissions" && newCount > 0 && <i className="pill">{newCount}</i>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <a className="side-site" href="/" target="_blank" rel="noopener">View website ↗</a>
      </aside>
      <button type="button" className="scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} />

      <div className="col">
        <header className="topbar">
          <button type="button" className="burger" aria-label="Menu" aria-expanded={open} aria-controls="admin-side" onClick={() => setOpen(!open)}>
            <span /><span /><span />
          </button>
          <Breadcrumbs />
          <details className="usermenu" ref={menu} key={pathname}>
            <summary aria-label="Account menu"><span className="avatar" aria-hidden="true">{initials}</span><span className="uname">{user.name || user.email}</span></summary>
            <div className="usermenu-panel">
              <p><b>{user.name}</b><br />{user.email}<br /><small>{user.role}</small></p>
              <a href="/" target="_blank" rel="noopener">View website ↗</a>
              <form action={signOut}><button type="submit">Sign out</button></form>
            </div>
          </details>
        </header>
        <main className="page" id="admin-main">{children}</main>
      </div>
    </div>
  );
}
