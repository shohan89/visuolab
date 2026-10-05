import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import CaseStudyPage from "@/components/site/case/CaseStudyPage";
import { getAdmin } from "@/lib/server/auth";
import { getCaseStudyBySlug, getSlugRedirect } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";

// Content comes from D1 at request time, then goes through the same page component as before.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Published case studies for everybody; drafts and archived ones only as a preview for a signed-in admin. */
async function load(slug: string) {
  const db = getDb();
  const live = await getCaseStudyBySlug(db, slug);
  if (live) return { study: live };
  const redirectTo = await getSlugRedirect(db, "case_study", slug);
  if (redirectTo) return { redirectTo };
  if (await getAdmin()) {
    const preview = await getCaseStudyBySlug(db, slug, { includeUnpublished: true });
    if (preview) return { study: preview };
  }
  return {};
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { study } = await load((await params).slug);
  return study ? { title: study.meta.title, description: study.meta.description } : {};
}

export default async function CaseStudyRoute({ params }: Props) {
  const { study, redirectTo } = await load((await params).slug);
  if (redirectTo) permanentRedirect(`/works/${redirectTo}`);
  if (!study) notFound();
  return <CaseStudyPage study={study} />;
}
