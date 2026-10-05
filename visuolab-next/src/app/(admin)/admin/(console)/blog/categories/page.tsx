import Link from "@/components/site/ui/Link";
import { addCategory, removeCategory, reorderCategory, saveCategory } from "@/actions/blog";
import BlogSubnav from "@/components/admin/BlogSubnav";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { listCategories } from "@/lib/server/blog-admin";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireAdmin();
  const cats = await listCategories();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Blog categories</h1>
          <p className="admin-sub">Every article has one category. Published categories are the filter chips on the Blog page, in this order.</p>
        </div>
      </div>
      <BlogSubnav current="categories" />

      <section className="form-card">
        <h2>New category</h2>
        <form action={addCategory} className="inline-form">
          <div className="field"><label htmlFor="new-title">Name</label><input id="new-title" name="title" type="text" required minLength={2} maxLength={40} /></div>
          <div className="field"><label htmlFor="new-slug">Slug (optional)</label><input id="new-slug" name="slug" type="text" maxLength={60} spellCheck={false} /></div>
          <SubmitButton className="primary">Add category</SubmitButton>
        </form>
      </section>

      {cats.length === 0 ? (
        <div className="empty-state"><b>No categories yet</b><p>Add one above, then assign it to articles.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th scope="col" className="col-order">Order</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col" className="col-num">Articles</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {cats.map((c, i) => (
                <tr key={c.id}>
                  <td className="col-order">
                    <form action={reorderCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" name="dir" value="up" disabled={i === 0} aria-label={`Move ${c.title} up`}>↑</button>
                      <button type="submit" name="dir" value="down" disabled={i === cats.length - 1} aria-label={`Move ${c.title} down`}>↓</button>
                    </form>
                  </td>
                  <td>
                    <details className="edit-row">
                      <summary><b>{c.title}</b> <small className="mono">{c.slug}</small></summary>
                      <form action={saveCategory} className="inline-form">
                        <input type="hidden" name="id" value={c.id} />
                        <div className="field"><label htmlFor={`t-${c.id}`}>Name</label><input id={`t-${c.id}`} name="title" type="text" defaultValue={c.title} required minLength={2} maxLength={40} /></div>
                        <div className="field"><label htmlFor={`s-${c.id}`}>Slug</label><input id={`s-${c.id}`} name="slug" type="text" defaultValue={c.slug} maxLength={60} spellCheck={false} /></div>
                        <div className="field">
                          <label htmlFor={`st-${c.id}`}>Status</label>
                          <select id={`st-${c.id}`} name="status" defaultValue={c.status}>
                            <option value="published">Published (filter chip shown)</option><option value="draft">Draft</option><option value="archived">Archived</option>
                          </select>
                        </div>
                        <SubmitButton className="primary">Save</SubmitButton>
                      </form>
                    </details>
                  </td>
                  <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                  <td className="col-num">{c.posts > 0 ? <Link href={`/admin/blog?category=${c.id}`}>{c.posts}</Link> : 0}</td>
                  <td>
                    <div className="row-actions">
                      <form action={removeCategory}>
                        <input type="hidden" name="id" value={c.id} />
                        <SubmitButton className="link danger-link" confirm={`Delete the category “${c.title}”?`}>Delete</SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint">A category with articles cannot be deleted or hidden: move its articles to another category first.</p>
    </>
  );
}
