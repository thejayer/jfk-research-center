/**
 * API client used by server components.
 *
 * Every SSR read goes straight to warehouse/data helpers so the Node
 * runtime never loops through JFK_API_BASE_URL or the public origin
 * (the load balancer). Public /api/* handlers stay available for
 * browsers.
 */

import { headers } from "next/headers";
import {
  createInternalRequestMarker,
  JFK_INTERNAL_REQUEST_MARKER_HEADER,
  JFK_REQUEST_FINGERPRINT_HEADER,
  JFK_REQUEST_ID_HEADER,
  JFK_TRAFFIC_CLASS_HEADER,
} from "./cost-request";
import { ApiRequestError } from "./api-request-error";
import {
  warehouseRequestContextFromHeaders,
  withWarehouseRequestContext,
} from "./warehouse-request-context";
import { getMediaAsset } from "./media-assets";
import {
  fetchAllEntities as fetchWarehouseEntities,
  fetchAllTopics as fetchWarehouseTopics,
  fetchBibliographyIndex as fetchWarehouseBibliographyIndex,
  fetchCaseTimeline as fetchWarehouseCaseTimeline,
  fetchCompare as fetchWarehouseCompare,
  fetchCorpusManifest as fetchWarehouseCorpusManifest,
  fetchDealeyPlazaWitnesses as fetchWarehouseDealeyPlazaWitnesses,
  fetchDocument as fetchWarehouseDocument,
  fetchDocumentOcrPage as fetchWarehouseDocumentOcrPage,
  fetchEntity as fetchWarehouseEntity,
  fetchEntityCooccurrence as fetchWarehouseEntityCooccurrence,
  fetchEstablishedFactsIndex as fetchWarehouseEstablishedFactsIndex,
  fetchHome as fetchWarehouseHome,
  fetchMediaIndex as fetchWarehouseMediaIndex,
  fetchOpenQuestionsIndex as fetchWarehouseOpenQuestionsIndex,
  fetchOpenQuestionsTopic as fetchWarehouseOpenQuestionsTopic,
  fetchPhysicalEvidenceIndex as fetchWarehousePhysicalEvidenceIndex,
  fetchPhysicalEvidenceItem as fetchWarehousePhysicalEvidenceItem,
  fetchSearch as fetchWarehouseSearch,
  fetchTopic as fetchWarehouseTopic,
} from "./warehouse";
import type {
  BibliographyIndex,
  CaseTimelineIndex,
  CooccurrenceGraph,
  CompareResponse,
  CorpusManifest,
  DealeyPlazaResponse,
  DealeyPlazaWitness,
  DocumentOcrPageResponse,
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
  ConfidenceLevel,
} from "./api-types";

type FetchOpts = {
  /** Cache hint forwarded to Next's fetch. */
  revalidate?: number;
  /** No-store for per-request responses. */
  noStore?: boolean;
  /** Optional abort signal for bounded server-side fetches. */
  signal?: AbortSignal;
};

export async function buildInternalFetchHeaders(
  incomingHeaders: Pick<Headers, "get">,
  opts: FetchOpts = {},
  markerSecret?: string,
): Promise<Headers> {
  const forwardedHeaders = new Headers();
  const headerNames = [
    JFK_REQUEST_FINGERPRINT_HEADER,
    JFK_TRAFFIC_CLASS_HEADER,
    ...(opts.noStore ? [JFK_REQUEST_ID_HEADER] : []),
  ];
  for (const headerName of headerNames) {
    const value = incomingHeaders.get(headerName);
    if (value) forwardedHeaders.set(headerName, value);
  }

  // Never forward a marker from the original request. Create a new signature
  // only after selecting the attribution headers safe for this fetch mode.
  if (
    forwardedHeaders.has(JFK_REQUEST_FINGERPRINT_HEADER) ||
    forwardedHeaders.has(JFK_TRAFFIC_CLASS_HEADER) ||
    forwardedHeaders.has(JFK_REQUEST_ID_HEADER)
  ) {
    const marker = await createInternalRequestMarker(
      forwardedHeaders,
      markerSecret,
    );
    if (marker) {
      forwardedHeaders.set(JFK_INTERNAL_REQUEST_MARKER_HEADER, marker);
    }
  }
  return forwardedHeaders;
}

async function loadWarehouseDirect<T>(
  path: string,
  route: string,
  loader: () => Promise<T>,
  errorStatus = 500,
): Promise<T> {
  try {
    const incomingHeaders = await headers();
    return await withWarehouseRequestContext(
      warehouseRequestContextFromHeaders(incomingHeaders, route),
      loader,
    );
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    console.error(`[api-client] in-process read failed for ${route}`, error);
    throw new ApiRequestError(errorStatus, path);
  }
}

export async function fetchHome(): Promise<HomeResponse> {
  const data = await loadWarehouseDirect(
    "/api/home",
    "ssr_home",
    () => fetchWarehouseHome(),
  );
  if (!data) throw new Error("Home payload missing");
  return data;
}

export async function fetchCorpusManifest(): Promise<CorpusManifest> {
  const data = await loadWarehouseDirect(
    "/api/corpus-manifest",
    "ssr_corpus_manifest",
    () => fetchWarehouseCorpusManifest(),
  );
  if (!data) throw new Error("Corpus manifest missing");
  return data;
}

export async function fetchMediaIndex(): Promise<MediaIndexResponse> {
  const data = await loadWarehouseDirect(
    "/api/media",
    "ssr_media",
    () => fetchWarehouseMediaIndex(),
  );
  if (!data) throw new Error("Media index missing");
  return data;
}

export async function fetchMediaAsset(id: string): Promise<MediaAsset | null> {
  return loadWarehouseDirect(
    `/api/media/${encodeURIComponent(id)}`,
    "ssr_media",
    async () => getMediaAsset(id),
  );
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

  const data = await loadWarehouseDirect(
    path,
    "ssr_search",
    () =>
      fetchWarehouseSearch({
        query,
        mode,
        filters: {
          agencies: filters.agency,
          yearFrom: filters.yearFrom,
          yearTo: filters.yearTo,
          entities: filters.entity,
          topics: filters.topic,
          confidence: filters.confidence as ConfidenceLevel[] | undefined,
        },
        offset,
      }),
    503,
  );
  if (!data) throw new Error("Search payload missing");
  return data;
}

export async function fetchEntity(slug: string): Promise<EntityResponse | null> {
  return loadWarehouseDirect(
    `/api/entity/${encodeURIComponent(slug)}`,
    "ssr_entity",
    () => fetchWarehouseEntity(slug),
  );
}

export async function fetchTopic(slug: string): Promise<TopicResponse | null> {
  return loadWarehouseDirect(
    `/api/topic/${encodeURIComponent(slug)}`,
    "ssr_topic",
    () => fetchWarehouseTopic(slug),
  );
}

export async function fetchTopics(): Promise<TopicCard[]> {
  return loadWarehouseDirect("/api/topics", "ssr_topics", async () => {
    const topics = await fetchWarehouseTopics();
    return topics ?? [];
  });
}

export async function fetchEntities(): Promise<EntityCard[]> {
  return loadWarehouseDirect("/api/entities", "ssr_entities", async () => {
    const entities = await fetchWarehouseEntities();
    return entities ?? [];
  });
}

export async function fetchDocument(
  id: string,
  chunkOrder?: number | null,
): Promise<DocumentResponse | null> {
  const query =
    chunkOrder != null && Number.isFinite(chunkOrder)
      ? `?chunk=${Math.trunc(chunkOrder)}`
      : "";
  return loadWarehouseDirect(
    `/api/document/${encodeURIComponent(id)}${query}`,
    "ssr_document",
    () =>
      fetchWarehouseDocument(id, {
        chunkOrder:
          chunkOrder != null && Number.isFinite(chunkOrder)
            ? Math.trunc(chunkOrder)
            : null,
      }),
  );
}

export async function fetchDocumentOcrPage(
  id: string,
  chunkOrder: number,
): Promise<DocumentOcrPageResponse | null> {
  return loadWarehouseDirect(
    `/api/document/${encodeURIComponent(id)}/ocr?chunk=${Math.trunc(chunkOrder)}`,
    "ssr_document",
    () => fetchWarehouseDocumentOcrPage(id, Math.trunc(chunkOrder)),
  );
}

export async function fetchCompare(recordId: string): Promise<CompareResponse | null> {
  const trimmedRecordId = recordId.trim();
  if (!trimmedRecordId) return null;

  return loadWarehouseDirect(
    `/api/compare?record=${encodeURIComponent(trimmedRecordId)}`,
    "ssr_compare",
    () => fetchWarehouseCompare(trimmedRecordId),
  );
}

export async function fetchOpenQuestionsIndex(): Promise<OpenQuestionsIndexResponse> {
  const data = await loadWarehouseDirect(
    "/api/open-questions",
    "ssr_open_questions",
    () => fetchWarehouseOpenQuestionsIndex(),
  );
  if (!data) throw new Error("Open questions payload missing");
  return data;
}

export async function fetchOpenQuestionsTopic(
  slug: string,
): Promise<OpenQuestionsTopicResponse | null> {
  return loadWarehouseDirect(
    `/api/open-questions/${encodeURIComponent(slug)}`,
    "ssr_open_questions",
    () => fetchWarehouseOpenQuestionsTopic(slug),
  );
}

export async function fetchPhysicalEvidenceIndex(): Promise<PhysicalEvidenceIndex> {
  const data = await loadWarehouseDirect(
    "/api/evidence",
    "ssr_evidence",
    () => fetchWarehousePhysicalEvidenceIndex(),
  );
  if (!data) throw new Error("Physical evidence index missing");
  return data;
}

export async function fetchEstablishedFactsIndex(): Promise<EstablishedFactsIndex> {
  const data = await loadWarehouseDirect(
    "/api/established-facts",
    "ssr_established_facts",
    () => fetchWarehouseEstablishedFactsIndex(),
  );
  if (!data) throw new Error("Established facts index missing");
  return data;
}

export async function fetchCaseTimeline(): Promise<CaseTimelineIndex> {
  const data = await loadWarehouseDirect(
    "/api/timeline",
    "ssr_timeline",
    () => fetchWarehouseCaseTimeline(),
  );
  if (!data) throw new Error("Timeline index missing");
  return data;
}

export async function fetchBibliographyIndex(): Promise<BibliographyIndex> {
  const data = await loadWarehouseDirect(
    "/api/bibliography",
    "ssr_bibliography",
    () => fetchWarehouseBibliographyIndex(),
  );
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
  const data = await loadWarehouseDirect(
    path,
    "ssr_graph",
    () => fetchWarehouseEntityCooccurrence(params),
  );
  if (!data) throw new Error("Graph payload missing");
  return data;
}

export async function fetchPhysicalEvidenceItem(
  id: string,
): Promise<PhysicalEvidenceDetail | null> {
  return loadWarehouseDirect(
    `/api/evidence/${encodeURIComponent(id)}`,
    "ssr_evidence",
    () => fetchWarehousePhysicalEvidenceItem(id),
  );
}

export async function fetchDealeyPlazaWitnesses(): Promise<DealeyPlazaResponse> {
  const data = await loadWarehouseDirect(
    "/api/dealey-plaza",
    "ssr_dealey_plaza",
    () => fetchWarehouseDealeyPlazaWitnesses(),
  );
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
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("dealey plaza witnesses timed out")),
      timeoutMs,
    );
  });

  try {
    const data = await Promise.race([
      loadWarehouseDirect(
        "/api/dealey-plaza",
        "ssr_dealey_plaza",
        () => fetchWarehouseDealeyPlazaWitnesses(),
      ),
      timeout,
    ]);
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
    if (timer) clearTimeout(timer);
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

export { ApiRequestError, isApiRequestError } from "./api-request-error";
