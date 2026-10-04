import type { Metadata } from "next";
import WorksPage from "@/components/site/works/WorksPage";

export const metadata: Metadata = {
  title: "Works — Visuolab",
  description: "Selected brand, product, web and packaging work by Visuolab — case studies with the results behind them.",
};

export default function WorksRoute() {
  return <WorksPage />;
}
