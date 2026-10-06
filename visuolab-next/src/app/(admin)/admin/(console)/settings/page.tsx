import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function SettingsIndex() {
  await requireAdmin();
  redirect("/admin/settings/general");
}
