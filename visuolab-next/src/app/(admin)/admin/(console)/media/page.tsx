import Link from "@/components/site/ui/Link";
import { LibraryUploader } from "@/components/admin/LibraryActions";
import { formatBytes } from "@/components/admin/media-types";
import { requireAdmin } from "@/lib/server/auth";
import { listMedia, mediaCounts } from "@/lib/server/media";
import { transformUrl } from "@/lib/media/url";

export const dynamic = "force-dynamic";

const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined => (allowed as readonly string[]).includes(v ?? "") ? (v as T) : undefined;

export default async function MediaLibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; storage?: string; unused?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const type = pick(sp.type, ["image", "video", "file"] as const);
  const storage = pick(sp.storage, ["static", "r2"] as const);
  const unused = sp.unused === "1";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [{ items, total, pages, page: current }, counts] = await Promise.all([listMedia({ q, type, storage, unused, page, limit: 24 }), mediaCounts()]);
  const filtered = !!(q.trim() || type || storage || unused);
  const link = (p: number) => `/admin/media?${new URLSearchParams({ ...(q ? { q } : {}), ...(type ? { type } : {}), ...(storage ? { storage } : {}), ...(unused ? { unused: "1" } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Media library</h1>
          <p className="admin-sub">{counts.all} files · {counts.r2} uploaded (stored in R2) · {counts.static} shipped with the website · {formatBytes(counts.bytes)}</p>
        </div>
      </div>

      <section className="form-card"><LibraryUploader /></section>

      <form className="toolbar" action="/admin/media" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Search title, description, caption or file name" aria-label="Search media" maxLength={100} />
        <select name="type" defaultValue={type ?? ""} aria-label="Type"><option value="">All types</option><option value="image">Images</option><option value="video">Videos</option><option value="file">Files</option></select>
        <select name="storage" defaultValue={storage ?? ""} aria-label="Where it is stored"><option value="">Uploaded and shipped</option><option value="r2">Uploaded (R2)</option><option value="static">Shipped with the website</option></select>
        <label className="check inline"><input type="checkbox" name="unused" value="1" defaultChecked={unused} /> Not used anywhere</label>
        <button type="submit">Filter</button>
        {filtered && <Link href="/admin/media">Clear</Link>}
      </form>

      {items.length === 0 ? (
        <div className="empty-state">
          <b>{filtered ? "No files match" : "The library is empty"}</b>
          <p>{filtered ? "Try another search or filter." : "Upload the first picture above."}</p>
          {filtered && <Link href="/admin/media">Show all files</Link>}
        </div>
      ) : (
        <>
          <p className="hint">{total} {total === 1 ? "file" : "files"}{filtered ? " match" : ""}</p>
          <ul className="media-grid">
            {items.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/media/${m.id}`}>
                  <span className="mg-thumb">{m.kind === "image" ? <img src={transformUrl(m.url, { width: 360 })} alt="" loading="lazy" /> : <span className="media-none">{m.kind}</span>}</span>
                  <span className="mg-title">{m.title}</span>
                  <span className="mg-meta">{m.width && m.height ? `${m.width}×${m.height}` : "—"} · {formatBytes(m.bytes)} · {m.storage === "r2" ? "uploaded" : "shipped"}</span>
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="pager">
              {current > 1 && <Link href={link(current - 1)}>← Newer</Link>}
              <span>Page {current} of {pages}</span>
              {current < pages && <Link href={link(current + 1)}>Older →</Link>}
            </div>
          )}
        </>
      )}
    </>
  );
}
