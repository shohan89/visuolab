import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import CaseStudyPage from "@/components/site/case/CaseStudyPage";
import JsonLd from "@/components/site/JsonLd";
import { getAdmin } from "@/lib/server/auth";
import { getCaseStudyBySlug, getSlugRedirect } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { getPage } from "@/lib/server/cms-pages";
import { caseStudySeo } from "@/lib/server/seo";

// Content comes from D1 at request time, then goes through the same page component as before.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Published case studies for everybody; drafts and archived ones only as a preview for a signed-in admin. */
async function load(slug: string) {
  const db = getDb();
  const live = await getCaseStudyBySlug(db, slug);
  if (live) return { study: live, preview: false };
  const redirectTo = await getSlugRedirect(db, "case_study", slug);
  if (redirectTo) return { redirectTo };
  if (await getAdmin()) {
    const preview = await getCaseStudyBySlug(db, slug, { includeUnpublished: true });
    if (preview) return { study: preview, preview: true };
  }
  return {};
}

/** Title and description from the case study row; canonical, Open Graph (cover picture), Twitter, robots and Article structured data from the same record. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { study, preview } = await load((await params).slug);
  return study ? (await caseStudySeo(study, !!preview)).metadata : {};
}

export default async function CaseStudyRoute({ params }: Props) {
  const { study, redirectTo, preview } = await load((await params).slug);
  if (redirectTo) permanentRedirect(`/works/${redirectTo}`);
  if (!study) notFound();
  const [seo, { content }] = await Promise.all([caseStudySeo(study, !!preview), getPage("case_study_detail")]);
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      <CaseStudyPage study={study} chrome={content.chrome} />
    </>
  );
}
