import Link from "@/components/site/ui/Link";
import { publishBlogPost, toggleFeaturedPost } from "@/actions/blog";
import BlogSubnav from "@/components/admin/BlogSubnav";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { listCategories, listPosts, listTags, type PostFilter } from "@/lib/server/blog-admin";

export const dynamic = "force-dynamic";

const TABS: { key: PostFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Published" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
];
const dt = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" });
const BADGE: Record<string, string> = { live: "published", scheduled: "scheduled", draft: "draft", archived: "archived" };
const BADGE_TEXT: Record<string, string> = { live: "published", scheduled: "scheduled", draft: "draft", archived: "archived" };

export default async function BlogAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string; tag?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = (TABS.some((t) => t.key === sp.status) ? sp.status : "all") as PostFilter;
  const q = (sp.q ?? "").slice(0, 100);
  const [categories, tags] = await Promise.all([listCategories(), listTags()]);
  const category = categories.some((c) => c.id === sp.category) ? sp.category : undefined;
  const tag = tags.some((t) => t.id === sp.tag) ? sp.tag : undefined;
  const { items, counts } = await listPosts({ q, filter, category, tag });
  const filtered = filter !== "all" || q.trim() !== "" || !!category || !!tag;
  const href = (s: string) => `/admin/blog?${new URLSearchParams({ ...(s !== "all" ? { status: s } : {}), ...(q ? { q } : {}), ...(category ? { category } : {}), ...(tag ? { tag } : {}) })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Blog</h1>
          <p className="admin-sub">The articles on the Blog page. Published ones are live at /blog/&lt;slug&gt;.</p>
        </div>
        <Link href="/admin/blog/new" className="btn primary">New article</Link>
      </div>
      <BlogSubnav current="articles" />

      <form className="toolbar" action="/admin/blog" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Search title, slug, author or text" aria-label="Search articles" maxLength={100} />
        <select name="category" defaultValue={category ?? ""} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => <option value={c.id} key={c.id}>{c.title}</option>)}
        </select>
        <select name="tag" defaultValue={tag ?? ""} aria-label="Filter by tag">
          <option value="">All tags</option>
          {tags.map((t) => <option value={t.id} key={t.id}>{t.title}</option>)}
        </select>
        {filter !== "all" && <input type="hidden" name="status" value={filter} />}
        <button type="submit">Search</button>
        {(q || category || tag) && <Link href={filter !== "all" ? `/admin/blog?status=${filter}` : "/admin/blog"}>Clear</Link>}
      </form>
      <nav className="tabs" aria-label="Filter by status">
        {TABS.map((t) => <Link href={href(t.key)} aria-current={filter === t.key ? "page" : undefined} key={t.key}>{t.label} <i>{counts[t.key]}</i></Link>)}
      </nav>

      {items.length === 0 ? (
        <div className="empty-state">
          <b>{filtered ? "No articles match" : "No articles yet"}</b>
          <p>{filtered ? "Try another search or filter." : "Write the first article."}</p>
          {filtered ? <Link href="/admin/blog">Show all articles</Link> : <Link href="/admin/blog/new" className="btn primary">New article</Link>}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col">Category</th>
                <th scope="col">Status</th>
                <th scope="col">Featured</th>
                <th scope="col">Date</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cell-media">
                      <img className="thumb" src={p.imageUrl} alt="" width={64} height={48} loading="lazy" />
                      <div>
                        <Link href={`/admin/blog/${p.id}`}><b>{p.title}</b></Link>
                        <br /><small className="mono">/blog/{p.slug}</small>
                        <br /><small>{p.author}{p.tags.length ? ` · ${p.tags.join(", ")}` : ""}</small>
                      </div>
                    </div>
                  </td>
                  <td>{p.category}</td>
                  <td><span className={`badge ${BADGE[p.visibility]}`}>{BADGE_TEXT[p.visibility]}</span></td>
                  <td>
                    <form action={toggleFeaturedPost}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className={p.featured ? "star on" : "star"} aria-label={p.featured ? `Remove ${p.title} from featured` : `Feature ${p.title}`} aria-pressed={p.featured} title={p.featured ? "Featured" : "Not featured"}>{p.featured ? "★" : "☆"}</button>
                    </form>
                  </td>
                  <td>
                    {p.publishedAt ? (p.visibility === "scheduled" ? <>Goes live<br /><small>{dt(p.publishedAt)} UTC</small></> : day(p.publishedAt)) : <small>Updated {day(p.updatedAt)}</small>}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/admin/blog/${p.id}`}>Edit</Link>
                      <a href={`/blog/${p.slug}`} target="_blank" rel="noopener">{p.visibility === "live" ? "View" : "Preview"}</a>
                      {p.visibility === "live" ? (
                        <Link href={`/admin/blog/${p.id}/confirm?do=unpublish`}>Unpublish</Link>
                      ) : p.visibility === "scheduled" ? (
                        <Link href={`/admin/blog/${p.id}/confirm?do=unpublish`}>Unschedule</Link>
                      ) : (
                        <form action={publishBlogPost}>
                          <input type="hidden" name="id" value={p.id} />
                          <SubmitButton className="link">Publish</SubmitButton>
                        </form>
                      )}
                      <Link href={`/admin/blog/${p.id}/confirm?do=delete`} className="danger-link">Delete</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint">Articles are listed newest first. “Scheduled” articles go live by themselves at their publish time (UTC).</p>
    </>
  );
}
