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
import {
  JFK_REQUEST_FINGERPRINT_HEADER,
  JFK_REQUEST_ID_HEADER,
  JFK_TRAFFIC_CLASS_HEADER,
} from "./cost-request";
import type {
  BibliographyIndex,
  CaseTimelineIndex,
  CooccurrenceGraph,
  CompareResponse,
  CorpusManifest,
  DealeyPlazaResponse,
  DealeyPlazaWitness,
  DocumentResponse,
  EntityCard,
  EntityResponse,
  EstablishedFactsIndex,
  HomeResponse,
  MediaIndexResponse,
  MediaAsset,
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
  /** Optional abort signal for bounded server-side fetches. */
  signal?: AbortSignal;
};

async function get<T>(path: string, opts: FetchOpts = {}): Promise<T | null> {
  const base = await getBaseUrl();
  const incomingHeaders = await headers();
  const forwardedHeaders = new Headers();
  for (const headerName of [
    JFK_REQUEST_ID_HEADER,
    JFK_REQUEST_FINGERPRINT_HEADER,
    JFK_TRAFFIC_CLASS_HEADER,
  ]) {
    const value = incomingHeaders.get(headerName);
    if (value) forwardedHeaders.set(headerName, value);
  }
  const res = await fetch(`${base}${path}`, {
    signal: opts.signal,
    headers: forwardedHeaders,
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

export async function fetchMediaIndex(): Promise<MediaIndexResponse> {
  const data = await get<MediaIndexResponse>("/api/media", { revalidate: 600 });
  if (!data) throw new Error("Media index missing");
  return data;
}

export async function fetchMediaAsset(id: string): Promise<MediaAsset | null> {
  return get<MediaAsset>(`/api/media/${encodeURIComponent(id)}`, {
    revalidate: 600,
  });
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
  const data = await get<SearchResponse>(path, { revalidate: 300 });
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

export async function fetchCompare(recordId: string): Promise<CompareResponse | null> {
  const trimmedRecordId = recordId.trim();
  if (!trimmedRecordId) return null;

  return get<CompareResponse>(
    `/api/compare?record=${encodeURIComponent(trimmedRecordId)}`,
    { revalidate: 600 },
  );
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

export type HistoricalWitnessStatus = "ready" | "error";

export type HistoricalWitnessPayload = {
  witnesses: DealeyPlazaWitness[];
  status: HistoricalWitnessStatus;
};

export async function fetchHistoricalDealeyPlazaWitnesses(
  timeoutMs = 4500,
): Promise<HistoricalWitnessPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const data = await get<unknown>("/api/dealey-plaza", {
      revalidate: 3600,
      signal: controller.signal,
    });
    if (!isDealeyPlazaResponse(data)) {
      return { witnesses: [], status: "error" };
    }

    return {
      witnesses: data.witnesses,
      status: "ready",
    };
  } catch {
    return { witnesses: [], status: "error" };
  } finally {
    clearTimeout(timeout);
  }
}

function isDealeyPlazaResponse(data: unknown): data is DealeyPlazaResponse {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<DealeyPlazaResponse>;
  return (
    Array.isArray(candidate.witnesses) &&
    candidate.witnesses.every(isDealeyPlazaWitness)
  );
}

function isDealeyPlazaWitness(data: unknown): data is DealeyPlazaWitness {
  if (!data || typeof data !== "object") return false;
  const witness = data as Partial<DealeyPlazaWitness>;
  return (
    typeof witness.witnessId === "string" &&
    typeof witness.name === "string" &&
    typeof witness.positionLat === "number" &&
    typeof witness.positionLng === "number" &&
    typeof witness.positionDescription === "string" &&
    typeof witness.statementSummary === "string" &&
    (typeof witness.heardShots === "number" || witness.heardShots === null) &&
    (typeof witness.shotOriginPerceived === "string" ||
      witness.shotOriginPerceived === null) &&
    (typeof witness.wcTestimonyVolume === "number" ||
      witness.wcTestimonyVolume === null) &&
    (typeof witness.wcTestimonyPage === "number" ||
      witness.wcTestimonyPage === null) &&
    Array.isArray(witness.sourceNaids) &&
    witness.sourceNaids.every((sourceNaid) => typeof sourceNaid === "string") &&
    (typeof witness.role === "string" || witness.role === null)
  );
}
