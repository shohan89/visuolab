import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ServicePage from "@/components/site/service/ServicePage";
import { serviceBySlug, services } from "@/content/services";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = serviceBySlug((await params).slug);
  return s ? { title: s.meta.title, description: s.meta.description } : {};
}

export default async function ServiceRoute({ params }: Props) {
  const service = serviceBySlug((await params).slug);
  if (!service) notFound();
  return <ServicePage service={service} />;
}
