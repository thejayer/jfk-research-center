import type { Metadata } from "next";
import { ResearchBriefBuilder } from "@/components/research/research-brief-builder";

export const metadata: Metadata = {
  title: "Research brief",
  description:
    "Build a local, source-linked research brief from saved JFK Research Center items.",
};

export default function ResearchBriefPage() {
  return <ResearchBriefBuilder />;
}
