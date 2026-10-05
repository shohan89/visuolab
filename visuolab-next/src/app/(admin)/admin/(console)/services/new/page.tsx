import Link from "@/components/site/ui/Link";
import ServiceForm from "@/components/admin/ServiceForm";
import { requireAdmin } from "@/lib/server/auth";
import { getEnv } from "@/lib/server/db";
import { caseOptions, mediaOptions } from "@/lib/server/services-admin";
import type { ServiceInput } from "@/lib/validation/service";

export const dynamic = "force-dynamic";

/** Starting values for a new service: the same sections every service page has, with prompts instead of content. */
const EMPTY: ServiceInput = {
  title: "", slug: "", status: "draft", metaTitle: "", metaDescription: "",
  heroTitle: "", heroLead: "", heroCtaLabel: "Book a call", heroCtaHref: "/contact", heroImageA: "", heroImageAAlt: "", heroImageB: "", heroImageBAlt: "",
  showProblems: false, problems: { label: "What we fix", title: "", items: [] },
  overview: { label: "Overview", title: "", blocks: [{ title: "", text: "" }] },
  outcomes: { label: "Outcomes", title: "", items: [{ value: "", text: "" }] },
  showBand: false, band: { text: "", ctaLabel: "Book a call", ctaHref: "/contact" },
  included: { label: "What is included", title: "", items: [] },
  process: { label: "Process", title: "", steps: [{ title: "", duration: "", text: "" }] },
  casesLabel: "Selected work", casesTitle: "", caseIds: [],
};

export default async function NewServicePage() {
  await requireAdmin();
  const [media, cases] = await Promise.all([mediaOptions(), caseOptions()]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>New service</h1>
          <p className="admin-sub"><Link href="/admin/services">← All services</Link></p>
        </div>
      </div>
      <ServiceForm initial={EMPTY} media={media} cases={cases} origin={getEnv().SITE_URL ?? ""} />
    </>
  );
}
