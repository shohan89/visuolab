import type { Metadata } from "next";
import WorksPage from "@/components/site/works/WorksPage";
import { getCaseStudies } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";

// The list of case studies comes from D1 at request time; the page itself is unchanged.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Works — Visuolab",
  description: "Selected brand, product, web and packaging work by Visuolab — case studies with the results behind them.",
};

export default async function WorksRoute() {
  const cases = await getCaseStudies(getDb(), { publishedOnly: true });
  return <WorksPage cases={cases} />;
}
