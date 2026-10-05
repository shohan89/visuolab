import { logout } from "@/actions/admin";
import AdminChrome from "@/components/admin/AdminChrome";
import ToastProvider from "@/components/admin/Toaster";
import { requireAdmin } from "@/lib/server/auth";
import { countsByStatus } from "@/lib/server/submissions";

export const dynamic = "force-dynamic";

/** Everything under /admin except the login page: signed-in admins only. The check also runs again in every action and page. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const counts = await countsByStatus();
  return (
    <ToastProvider>
      <AdminChrome user={{ name: admin.name, email: admin.email, role: admin.role }} newCount={counts.new} signOut={logout}>
        {children}
      </AdminChrome>
    </ToastProvider>
  );
}
