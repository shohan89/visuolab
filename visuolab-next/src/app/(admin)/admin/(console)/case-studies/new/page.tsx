import Link from "@/components/site/ui/Link";
import CaseStudyForm from "@/components/admin/CaseStudyForm";
import { requireAdmin } from "@/lib/server/auth";
import { otherCases, serviceOptions } from "@/lib/server/case-studies-admin";
import { getEnv } from "@/lib/server/db";
import { mediaOptions } from "@/lib/server/services-admin";
import type { CaseStudyInput } from "@/lib/validation/case-study";

export const dynamic = "force-dynamic";

const shot = { media: "", caption: "", alt: "", position: "" };

/** Starting values for a new case study: the same sections every case study page has, with prompts instead of content. */
const EMPTY: CaseStudyInput = {
  title: "", slug: "", status: "draft", featured: false,
  clientName: "", clientFull: "", industry: "", services: "", year: String(new Date().getUTCFullYear()), timeline: "",
  typeLine: "", shortKind: "", cardTags: [""], filters: [], cardImage: "", cardImageAlt: "", coverImage: "", coverImageAlt: "",
  metaTitle: "", metaDescription: "",
  aboutLabel: "About project", description: "", stats: [{ value: "", label: "" }],
  galleryA: [{ ...shot }], process: { label: "Approach", title: "", steps: [{ title: "", duration: "", text: "", deliverables: [] }] },
  galleryB: [{ ...shot }], challenges: { label: "Challenge", title: "", items: [{ title: "", text: "" }] },
  wide: { ...shot }, results: { label: "Results", title: "", items: [{ metric: true, text: "" }] },
  more: { label: "More work", title: "", slugs: [] },
  showcase: { title: "", tags: [""], variant: "results", results: [{ value: "", text: "" }], quote: { source: "", text: "", avatar: "", name: "", role: "" } },
  serviceIds: [],
};

export default async function NewCaseStudyPage() {
  await requireAdmin();
  const [media, others, services] = await Promise.all([mediaOptions(), otherCases(), serviceOptions()]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>New case study</h1>
          <p className="admin-sub"><Link href="/admin/case-studies">← All case studies</Link></p>
        </div>
      </div>
      <CaseStudyForm initial={EMPTY} media={media} others={others} services={services} origin={getEnv().SITE_URL ?? ""} />
    </>
  );
}
