import { EntityOverview } from "@/components/admin/EntityScreens";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EntityOverview kind="service" id={(await params).id} />;
}
