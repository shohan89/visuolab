import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import PageSeoForm from "@/components/admin/PageSeoForm";
import { TEMPLATES, templateFromParam, templateSlug } from "@/lib/cms/registry";
import { requireAdmin } from "@/lib/server/auth";
import { adminSections, seoDefaults, seoSite } from "@/lib/server/cms-admin";
import { mediaOptions } from "@/lib/server/services-admin";

export const dynamic = "force-dynamic";

/** The SEO editor of a page that has an address. */
export default async function PageSeoAdmin({ params }: { params: Promise<{ page: string }> }) {
  await requireAdmin();
  const template = templateFromParam((await params).page);
  if (!template || !TEMPLATES[template].hasSeo) notFound();
  const def = TEMPLATES[template];
  const { page } = await adminSections(template);
  const base = `/admin/pages/${templateSlug(template)}`;
  const [media, defaults, site] = await Promise.all([page ? mediaOptions() : Promise.resolve([]), seoDefaults(template), seoSite()]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>SEO <span className="badge">{def.label}</span></h1>
          <p className="admin-sub"><Link href={base}>← {def.label}</Link> · <code>{def.route}</code></p>
        </div>
        <div className="head-actions">
          <a className="btn" href={def.route!} target="_blank" rel="noopener">Preview ↗</a>
        </div>
      </div>
      {!page ? (
        <p className="form-errors" role="status"><b>This page has no content in the database yet.</b> Run <code>npm run db:seed:pages:remote</code>, then edit its SEO here.</p>
      ) : (
        <PageSeoForm
          template={template}
          updatedAt={page.updatedAt}
          media={media}
          defaults={defaults}
          site={{ ...site, path: def.route! }}
          initial={{ seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "", ogImageId: page.ogImageId ?? "", canonicalUrl: page.canonicalUrl ?? "", noindex: page.noindex, nofollow: page.nofollow }}
        />
      )}
    </>
  );
}
