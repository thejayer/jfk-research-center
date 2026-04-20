/**
 * API client used by server components.
 *
 * This module is the single point of data access for pages. It calls
 * the internal Next.js API routes so the UI never imports mock-data
 * or warehouse code directly.
 *
 * In production, JFK_API_BASE_URL may point to a Cloud Run service or
 * an absolute URL for a separate deployment. In local development, the
 * same-host API routes are used via an absolute URL derived from
 * the request headers.
 */

import { headers } from "next/headers";
import type {
  BibliographyIndex,
  CaseTimelineIndex,
  CooccurrenceGraph,
  CorpusManifest,
  DealeyPlazaResponse,
  DocumentResponse,
  EntityCard,
  EntityResponse,
  EstablishedFactsIndex,
  HomeResponse,
  OpenQuestionsIndexResponse,
  OpenQuestionsTopicResponse,
  PhysicalEvidenceDetail,
  PhysicalEvidenceIndex,
  SearchResponse,
  TopicCard,
  TopicResponse,
} from "./api-types";

async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.JFK_API_BASE_URL;
  if (envUrl && envUrl.startsWith("http")) return envUrl.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

type FetchOpts = {
  /** Cache hint forwarded to Next's fetch. */
  revalidate?: number;
  /** No-store for per-request responses. */
  noStore?: boolean;
};

async function get<T>(path: string, opts: FetchOpts = {}): Promise<T | null> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...(opts.noStore
      ? { cache: "no-store" as const }
      : { next: { revalidate: opts.revalidate ?? 60 } }),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${path}`);
  }
  return (await res.json()) as T;
}

export async function fetchHome(): Promise<HomeResponse> {
  const data = await get<HomeResponse>("/api/home", { revalidate: 600 });
  if (!data) throw new Error("Home payload missing");
  return data;
}

export async function fetchCorpusManifest(): Promise<CorpusManifest> {
  const data = await get<CorpusManifest>("/api/corpus-manifest", {
    revalidate: 600,
  });
  if (!data) throw new Error("Corpus manifest missing");
  return data;
}

export async function fetchSearch(
  query: string,
  mode: "document" | "mention" | "semantic" = "document",
  filters: {
    agency?: string[];
    yearFrom?: number | null;
    yearTo?: number | null;
    entity?: string[];
    topic?: string[];
    confidence?: string[];
  } = {},
  offset = 0,
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (mode !== "document") params.set("mode", mode);
  for (const k of ["agency", "entity", "topic", "confidence"] as const) {
    for (const v of filters[k] ?? []) params.append(k, v);
  }
  if (filters.yearFrom != null) params.set("yearFrom", String(filters.yearFrom));
  if (filters.yearTo != null) params.set("yearTo", String(filters.yearTo));
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  const path = qs ? `/api/search?${qs}` : "/api/search";
  const data = await get<SearchResponse>(path, { noStore: true });
  if (!data) throw new Error("Search payload missing");
  return data;
}

export async function fetchEntity(slug: string): Promise<EntityResponse | null> {
  return get<EntityResponse>(`/api/entity/${encodeURIComponent(slug)}`, {
    revalidate: 600,
  });
}

export async function fetchTopic(slug: string): Promise<TopicResponse | null> {
  return get<TopicResponse>(`/api/topic/${encodeURIComponent(slug)}`, {
    revalidate: 600,
  });
}

export async function fetchTopics(): Promise<TopicCard[]> {
  const data = await get<{ topics: TopicCard[] }>("/api/topics", {
    revalidate: 600,
  });
  return data?.topics ?? [];
}

export async function fetchEntities(): Promise<EntityCard[]> {
  const data = await get<{ entities: EntityCard[] }>("/api/entities", {
    revalidate: 600,
  });
  return data?.entities ?? [];
}

export async function fetchDocument(id: string): Promise<DocumentResponse | null> {
  return get<DocumentResponse>(`/api/document/${encodeURIComponent(id)}`, {
    revalidate: 600,
  });
}

export async function fetchOpenQuestionsIndex(): Promise<OpenQuestionsIndexResponse> {
  const data = await get<OpenQuestionsIndexResponse>("/api/open-questions", {
    revalidate: 600,
  });
  if (!data) throw new Error("Open questions payload missing");
  return data;
}

export async function fetchOpenQuestionsTopic(
  slug: string,
): Promise<OpenQuestionsTopicResponse | null> {
  return get<OpenQuestionsTopicResponse>(
    `/api/open-questions/${encodeURIComponent(slug)}`,
    { revalidate: 600 },
  );
}

export async function fetchPhysicalEvidenceIndex(): Promise<PhysicalEvidenceIndex> {
  const data = await get<PhysicalEvidenceIndex>("/api/evidence", {
    revalidate: 600,
  });
  if (!data) throw new Error("Physical evidence index missing");
  return data;
}

export async function fetchEstablishedFactsIndex(): Promise<EstablishedFactsIndex> {
  const data = await get<EstablishedFactsIndex>("/api/established-facts", {
    revalidate: 600,
  });
  if (!data) throw new Error("Established facts index missing");
  return data;
}

export async function fetchCaseTimeline(): Promise<CaseTimelineIndex> {
  const data = await get<CaseTimelineIndex>("/api/timeline", {
    revalidate: 600,
  });
  if (!data) throw new Error("Timeline index missing");
  return data;
}

export async function fetchBibliographyIndex(): Promise<BibliographyIndex> {
  const data = await get<BibliographyIndex>("/api/bibliography", {
    revalidate: 600,
  });
  if (!data) throw new Error("Bibliography index missing");
  return data;
}

export async function fetchEntityCooccurrence(
  params: { yearFrom?: number; yearTo?: number; minCount?: number } = {},
): Promise<CooccurrenceGraph> {
  const qs = new URLSearchParams();
  if (params.yearFrom != null) qs.set("yearFrom", String(params.yearFrom));
  if (params.yearTo != null) qs.set("yearTo", String(params.yearTo));
  if (params.minCount != null) qs.set("minCount", String(params.minCount));
  const path = qs.toString() ? `/api/graph?${qs}` : "/api/graph";
  const data = await get<CooccurrenceGraph>(path, { revalidate: 600 });
  if (!data) throw new Error("Graph payload missing");
  return data;
}

export async function fetchPhysicalEvidenceItem(
  id: string,
): Promise<PhysicalEvidenceDetail | null> {
  return get<PhysicalEvidenceDetail>(
    `/api/evidence/${encodeURIComponent(id)}`,
    { revalidate: 600 },
  );
}

export async function fetchDealeyPlazaWitnesses(): Promise<DealeyPlazaResponse> {
  const data = await get<DealeyPlazaResponse>("/api/dealey-plaza", {
    revalidate: 3600,
  });
  if (!data) throw new Error("Dealey Plaza payload missing");
  return data;
}
