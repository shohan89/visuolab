import NavigationEditor from "@/components/admin/NavigationEditor";
import { requireAdmin } from "@/lib/server/auth";
import { listSection, pageOptions } from "@/lib/server/navigation-admin";

export const dynamic = "force-dynamic";

export default async function NavigationPage() {
  await requireAdmin();
  const [header, footer, pages] = await Promise.all([listSection("header"), listSection("footer"), pageOptions()]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Navigation</h1>
          <p className="admin-sub">The links in the website header and footer. Drag the handle or use the arrows to reorder. Each section is saved on its own.</p>
        </div>
      </div>
      <NavigationEditor section="header" initial={header} pages={pages} />
      <NavigationEditor section="footer" initial={footer} pages={pages} />
    </>
  );
}
