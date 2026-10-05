import Link from "@/components/site/ui/Link";
import { removeTag, saveTag } from "@/actions/blog";
import BlogSubnav from "@/components/admin/BlogSubnav";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { listTags } from "@/lib/server/blog-admin";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  await requireAdmin();
  const tags = await listTags();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Blog tags</h1>
          <p className="admin-sub">Tags help you organise articles and are sent to search engines as keywords. Create them while writing an article.</p>
        </div>
      </div>
      <BlogSubnav current="tags" />

      {tags.length === 0 ? (
        <div className="empty-state"><b>No tags yet</b><p>Add tags in the article form and they appear here.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th scope="col">Tag</th><th scope="col" className="col-num">Articles</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.id}>
                  <td>
                    <details className="edit-row">
                      <summary><b>{t.title}</b> <small className="mono">{t.slug}</small></summary>
                      <form action={saveTag} className="inline-form">
                        <input type="hidden" name="id" value={t.id} />
                        <div className="field"><label htmlFor={`t-${t.id}`}>Name</label><input id={`t-${t.id}`} name="title" type="text" defaultValue={t.title} required minLength={2} maxLength={30} /></div>
                        <SubmitButton className="primary">Rename</SubmitButton>
                      </form>
                    </details>
                  </td>
                  <td className="col-num">{t.posts > 0 ? <Link href={`/admin/blog?tag=${t.id}`}>{t.posts}</Link> : 0}</td>
                  <td>
                    <div className="row-actions">
                      <form action={removeTag}>
                        <input type="hidden" name="id" value={t.id} />
                        <SubmitButton className="link danger-link" confirm={t.posts ? `Delete the tag “${t.title}”? It is removed from ${t.posts} article(s).` : `Delete the tag “${t.title}”?`}>Delete</SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
