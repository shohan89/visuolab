import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { getAdmin } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin/submissions");
  return <LoginForm />;
}
