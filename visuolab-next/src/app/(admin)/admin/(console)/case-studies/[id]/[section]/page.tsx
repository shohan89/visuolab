import { EntitySectionScreen } from "@/components/admin/EntityScreens";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  return <EntitySectionScreen kind="case_study" id={id} sectionKey={section} />;
}
