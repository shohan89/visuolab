import Link from "@/components/site/ui/Link";
import { logout } from "@/actions/admin";
import { requireAdmin } from "@/lib/server/auth";
import { countsByStatus } from "@/lib/server/submissions";

export const dynamic = "force-dynamic";

/** Everything under /admin except the login page: signed-in admins only. The check also runs again in every action. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const counts = await countsByStatus();
  return (
    <>
      <header className="admin-top">
        <strong>Visuolab admin</strong>
        <nav aria-label="Admin">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/submissions">Submissions{counts.new ? ` (${counts.new} new)` : ""}</Link>
        </nav>
        <span className="who">{admin.email}</span>
        <form action={logout}><button type="submit">Sign out</button></form>
      </header>
      <main className="admin-main">{children}</main>
    </>
  );
}
