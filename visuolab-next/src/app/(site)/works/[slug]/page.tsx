import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import CaseStudyPage from "@/components/site/case/CaseStudyPage";
import PreviewBar from "@/components/site/PreviewBar";
import { enterPreview } from "@/lib/server/preview";
import JsonLd from "@/components/site/JsonLd";
import { getCaseStudyPreview } from "@/lib/server/entity-preview";
import { getAdmin } from "@/lib/server/auth";
import { getCaseStudyBySlug, getHiddenSections, getSlugRedirect } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { getPage } from "@/lib/server/cms-pages";
import { caseStudySeo } from "@/lib/server/seo";

// Content comes from D1 at request time, then goes through the same page component as before.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
type Page = Props & { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Published case studies for everybody; drafts and archived ones only as a preview for a signed-in admin. */
async function load(slug: string, draft = false) {
  const db = getDb();
  if (draft) { const p = await getCaseStudyPreview(slug); if (p) return { study: p, preview: true }; } // an admin's preview: the page with its draft changes
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

export default async function CaseStudyRoute({ params, searchParams }: Page) {
  const draft = await enterPreview(await searchParams);
  const { study, redirectTo, preview } = await load((await params).slug, draft);
  if (redirectTo) permanentRedirect(`/works/${redirectTo}`);
  if (!study) notFound();
  const [seo, { content }, hidden] = await Promise.all([caseStudySeo(study, !!preview), getPage("case_study_detail"), getHiddenSections(getDb(), "case_study", study.slug)]);
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      {draft && <PreviewBar what="this case study with its draft changes" back="/admin/case-studies" />}
      <CaseStudyPage study={study} chrome={content.chrome} hidden={hidden} />
    </>
  );
}
