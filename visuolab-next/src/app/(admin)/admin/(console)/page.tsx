import Link from "@/components/site/ui/Link";
import { requireAdmin } from "@/lib/server/auth";
import { getDashboard } from "@/lib/server/dashboard";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
const excerpt = (text: string, max = 110) => (text.length > max ? text.slice(0, max).trimEnd() + "…" : text);

export default async function AdminOverview() {
  const admin = await requireAdmin(); // the layout checks too; every page does its own check
  const d = await getDashboard();
  const stats = [
    { label: "Services", value: d.services, href: undefined },
    { label: "Published case studies", value: d.publishedCases, href: undefined },
    { label: "Published blog posts", value: d.publishedPosts, href: undefined },
    { label: "Unread submissions", value: d.unread, href: "/admin/submissions?status=new", highlight: d.unread > 0 },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="admin-sub">Welcome back, {admin.name.split(" ")[0] || admin.name}.</p>
        </div>
      </div>

      <section className="stats" aria-label="Totals">
        {stats.map((s) => {
          const body = (
            <>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </>
          );
          return s.href ? (
            <Link className={s.highlight ? "stat is-hot" : "stat"} href={s.href} key={s.label}>{body}</Link>
          ) : (
            <div className="stat" key={s.label}>{body}</div>
          );
        })}
      </section>

      <div className="grid-2">
        <section className="panel" aria-labelledby="recent-sub">
          <header>
            <h2 id="recent-sub">Recent submissions</h2>
            <Link href="/admin/submissions">View all</Link>
          </header>
          {d.recentSubmissions.length === 0 ? (
            <div className="empty-state">
              <b>No messages yet</b>
              <p>Messages from the contact form will appear here.</p>
            </div>
          ) : (
            <ul className="rows">
              {d.recentSubmissions.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/submissions?status=${s.status}`}>
                    <span className="row-main">
                      <b>{s.name}</b>
                      <span className={`badge ${s.status}`}>{s.status}</span>
                    </span>
                    <span className="row-sub">{excerpt(s.message)}</span>
                    <time dateTime={s.createdAt}>{when(s.createdAt)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="recent-upd">
          <header>
            <h2 id="recent-upd">Recent content updates</h2>
          </header>
          {d.recentUpdates.length === 0 ? (
            <div className="empty-state">
              <b>Nothing edited yet</b>
              <p>Changes to services, case studies, posts, media and settings will be listed here.</p>
            </div>
          ) : (
            <ul className="rows">
              {d.recentUpdates.map((u, i) => (
                <li key={`${u.kind}-${u.title}-${i}`}>
                  <span className="row-plain">
                    <span className="row-main">
                      <b>{u.title}</b>
                      <span className="kind">{u.kind}</span>
                      <span className={`badge ${u.status}`}>{u.status}</span>
                    </span>
                    <time dateTime={u.updatedAt}>{when(u.updatedAt)}</time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
