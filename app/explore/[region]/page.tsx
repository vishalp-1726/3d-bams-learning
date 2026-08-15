import { notFound } from "next/navigation";
import type { Metadata } from "next";
import models from "@/data/models.json";
import type { ModelEntry } from "@/lib/types";
import ExplorerClient from "./ExplorerClient";

const REGIONS = models as ModelEntry[];

export function generateStaticParams() {
  return REGIONS.map((m) => ({ region: m.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  const model = REGIONS.find((m) => m.id === region);
  if (!model) return {};
  return { title: model.title, description: model.blurb };
}

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  const model = REGIONS.find((m) => m.id === region);
  if (!model) notFound();

  return <ExplorerClient model={model} />;
}
