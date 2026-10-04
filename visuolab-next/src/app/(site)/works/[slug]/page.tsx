import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CaseStudyPage from "@/components/site/case/CaseStudyPage";
import { caseBySlug, caseStudies } from "@/content/cases";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return caseStudies.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = caseBySlug((await params).slug);
  return c ? { title: c.meta.title, description: c.meta.description } : {};
}

export default async function CaseStudyRoute({ params }: Props) {
  const study = caseBySlug((await params).slug);
  if (!study) notFound();
  return <CaseStudyPage study={study} />;
}
