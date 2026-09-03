/**
 * BigQuery warehouse adapter.
 *
 * Replaces lib/mock-data.ts behind the API routes. Produces the same
 * response shapes declared in lib/api-types.ts so the UI does not change.
 *
 * Authentication:
 *   - In Cloud Run / GCE / Cloud Build, uses the attached service account
 *     via Application Default Credentials automatically.
 *   - For local development, run `gcloud auth application-default login`
 *     or set GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Project & location:
 *   - Project id is read from JFK_BQ_PROJECT (defaults to "jfk-vault").
 *   - Dataset locations are fixed to "US" (where the tables live).
 */

import { BigQuery } from "@google-cloud/bigquery";
import type {
  ConfidenceLevel,
  CorpusManifest,
  RedactionAction,
  RedactionActionType,
  RedactionDetection,
  RedactionDocDetail,
  RedactionQueueItem,
  RedactionQueueResponse,
  OcrProgressResponse,
  OcrReleaseProgress,
  OcrFailureItem,
  RedactionReviewStatus,
  DocumentCard,
  DocumentDetail,
  DocumentOcrPageResponse,
  DocumentResponse,
  OcrPage,
  EditorialFootnote,
  EntityCard,
  EntityDetail,
  EntityFact,
  EntityResponse,
  EntitySource,
  EstablishedFact,
  EstablishedFactCategory,
  EstablishedFactConfidence,
  EstablishedFactsIndex,
  BibliographyIndex,
  CaseTimelineCategory,
  CaseTimelineEvent,
  CaseTimelineIndex,
  CompareResponse,
  TimelineEvent,
  CitationEntry,
  CitationType,
  CooccurrenceGraph,
  CooccurrenceLink,
  CooccurrenceNode,
  CryptonymEntry,
  DealeyPlazaResponse,
  DealeyPlazaWitness,
  PhysicalEvidenceCard,
  PhysicalEvidenceCategory,
  PhysicalEvidenceDetail,
  PhysicalEvidenceIndex,
  ReleaseHistoryEntry,
  HomeResponse,
  MediaIndexResponse,
  MentionExcerpt,
  OpenQuestionThread,
  OpenQuestionsArticle,
  OpenQuestionsIndexResponse,
  OpenQuestionsTopicCard,
  OpenQuestionsTopicResponse,
  SearchResponse,
  SearchResult,
  SearchFilterInput,
  SearchFilters as SearchFacetData,
  TopicCard,
  TopicDetail,
  TopicResponse,
} from "./api-types";
import { ocrCoverageSentence } from "./corpus-coverage";
import { computeDealeyPlazaBounds } from "./dealey-plaza-bounds";
import {
  displayDocumentTitle,
  documentDisplayFields,
  documentReaderHref,
} from "./document-reader";
import { formatDate } from "./format";
import { buildMediaIndexResponse } from "./media-assets";
import { addMediaAssetsToCooccurrenceGraph } from "./media-graph";
import {
  buildDocumentResponse,
  buildEntityCooccurrence,
  buildBibliographyIndex,
  buildCaseTimelineIndex,
  buildCompareResponse,
  buildDealeyPlazaResponse,
  buildEntityResponse,
  buildEstablishedFactsIndex,
  buildHomeResponse,
  buildOpenQuestionsIndex,
  buildOpenQuestionsTopic,
  buildPhysicalEvidenceIndex,
  buildPhysicalEvidenceItem,
  buildSearchResponse,
  buildTopicResponse,
  listEntities as listMockEntities,
  listTopics as listMockTopics,
  listDocuments as listMockDocuments,
  entityToCard as mockEntityToCard,
  topicToCard as mockTopicToCard,
} from "./mock-data";
import { normalizeSourceUrl } from "./source-urls";
import {
  isBigQueryBytesBilledExceeded,
  isBigQueryNotFound,
} from "./bigquery-errors";
import {
  isArchiveIdentifierQuery,
  readBigQueryMaximumBytesBilled,
} from "./cost-controls";
import {
  documentCacheKey,
  withDocumentCache,
} from "./document-cache";
import { searchCacheKey, withSearchCache } from "./search-cache";
import { extractSearchTokens, ocrTokenRangeParams } from "./search-tokens";
import { warehouseJobLabels } from "./warehouse-request-context";
import {
  denseSearchFacetYears,
  rankedFacetValues,
  searchFacetCountScope,
  searchFiltersForMode,
  semanticCandidateLimit,
  SEARCH_FACET_YEAR_BOUNDS,
} from "./search-facets";
import { aggregateQuerySearchFacets } from "./search-facet-aggregates";
import type { SearchFacetDocument } from "./search-facet-aggregates";
import {
  isOcrPageMetaTableUnavailable,
  markOcrPageMetaTableUnavailable,
  ocrPageMetaCache,
  type OcrPageMetaRecord,
} from "./ocr-page-meta-cache";
import {
  buildCorpusAgencyFacetSql,
  buildCorpusEntityFacetSql,
  buildCorpusTopicFacetSql,
  buildCorpusYearFacetSql,
  buildDocumentOnePageSql,
  buildDocumentPageMetaSql,
  buildDocumentPagesSql,
  buildDocumentReadBundleSql,
  buildDocumentReadCoreSql,
  buildDocumentTopicCountSql,
  buildDocumentTopicSlugsSql,
  sortTopicSlugsByDisplayOrder,
  buildDocumentSearchCountSql,
  buildDocumentSearchSql,
  buildEntityMembershipSql,
  buildFilterOnlyDocumentsSql,
  buildIdentifierSearchSql,
  buildMentionSearchCountSql,
  buildMentionSearchSql,
  buildOcrHitDocumentIdSql,
  buildOcrSnippetSql,
  buildQueryMatchedDocumentsSql,
  buildTopicMembershipSql,
  recordsTable,
  type TopicTableRef,
  type WarehouseTableRef,
} from "./warehouse-search-sql";

const PROJECT = process.env.JFK_BQ_PROJECT || "jfk-vault";
const DATASET_CURATED = "jfk_curated";
const DATASET_MVP = "jfk_mvp";
const DATA_SOURCE = process.env.JFK_DATA_SOURCE?.toLowerCase();
const WAREHOUSE_TABLES: WarehouseTableRef = {
  project: PROJECT,
  curatedDataset: DATASET_CURATED,
  mvpDataset: DATASET_MVP,
};

function useMockData(): boolean {
  return DATA_SOURCE === "mock";
}

let _bq: BigQuery | null = null;
function bq(): BigQuery {
  if (!_bq) {
    _bq = new BigQuery({ projectId: PROJECT, location: "US" });
  }
  return _bq;
}

async function query<T = Record<string, unknown>>(
  sql: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const maximumBytesBilled = readBigQueryMaximumBytesBilled();
  const types = bigQueryParamTypes(params);
  const [rows] = await bq().query({
    query: sql,
    params,
    location: "US",
    labels: warehouseJobLabels(),
    ...(types ? { types } : {}),
    ...(maximumBytesBilled ? { maximumBytesBilled } : {}),
  });
  return rows as T[];
}

/** Empty arrays need an explicit BigQuery type or the job is rejected. */
function bigQueryParamTypes(
  params: Record<string, unknown>,
): Record<string, string | string[]> | undefined {
  const types: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value) && value.length === 0) {
      types[key] = ["STRING"];
    } else if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => typeof item === "number")
    ) {
      types[key] = ["INT64"];
    }
  }
  return Object.keys(types).length > 0 ? types : undefined;
}

// ---------------------------------------------------------------------------
// Public corrections form — backed by sql/40.
// ---------------------------------------------------------------------------

export type CorrectionInsert = {
  submissionId: string;
  surface: string;
  targetId: string;
  issue: string;
  suggestedFix: string;
  submitterEmail: string;
  userAgent: string;
};

export async function insertCorrection(input: CorrectionInsert): Promise<void> {
  await bq()
    .dataset(DATASET_CURATED)
    .table("corrections_submissions")
    .insert([
      {
        submission_id: input.submissionId,
        submitted_at: new Date().toISOString(),
        surface: input.surface,
        target_id: input.targetId || null,
        issue: input.issue,
        suggested_fix: input.suggestedFix || null,
        submitter_email: input.submitterEmail || null,
        status: "new",
        user_agent: input.userAgent || null,
        notes: null,
      },
    ]);
}

export type CorrectionStatus = "new" | "reviewing" | "resolved" | "rejected";

export type CorrectionRow = {
  submissionId: string;
  submittedAt: string;
  surface: string;
  targetId: string | null;
  issue: string;
  suggestedFix: string | null;
  submitterEmail: string | null;
  status: CorrectionStatus;
  notes: string | null;
};

export async function fetchCorrections(
  opts: { status?: CorrectionStatus; limit?: number } = {},
): Promise<{
  items: CorrectionRow[];
  counts: Record<CorrectionStatus, number>;
}> {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 200));
  const whereSql = opts.status ? "WHERE status = @status" : "";
  const params: Record<string, unknown> = {};
  if (opts.status) params.status = opts.status;

  const [rowsRaw, countsRaw] = await Promise.all([
    query<{
      submission_id: string;
      submitted_at: { value: string } | string;
      surface: string;
      target_id: string | null;
      issue: string;
      suggested_fix: string | null;
      submitter_email: string | null;
      status: string;
      notes: string | null;
    }>(
      `SELECT submission_id, submitted_at, surface, target_id, issue,
              suggested_fix, submitter_email, status, notes
         FROM \`${PROJECT}.${DATASET_CURATED}.corrections_submissions\`
         ${whereSql}
        ORDER BY submitted_at DESC
        LIMIT ${Number(limit)}`,
      params,
    ),
    query<{ status: string; n: number }>(
      `SELECT status, COUNT(*) AS n
         FROM \`${PROJECT}.${DATASET_CURATED}.corrections_submissions\`
        GROUP BY status`,
    ),
  ]);

  const counts: Record<CorrectionStatus, number> = {
    new: 0,
    reviewing: 0,
    resolved: 0,
    rejected: 0,
  };
  for (const r of countsRaw) {
    if (
      r.status === "new" ||
      r.status === "reviewing" ||
      r.status === "resolved" ||
      r.status === "rejected"
    ) {
      counts[r.status] = Number(r.n ?? 0);
    }
  }

  const items: CorrectionRow[] = rowsRaw.map((r) => ({
    submissionId: r.submission_id,
    submittedAt:
      typeof r.submitted_at === "object"
        ? r.submitted_at.value
        : r.submitted_at,
    surface: r.surface,
    targetId: r.target_id,
    issue: r.issue,
    suggestedFix: r.suggested_fix,
    submitterEmail: r.submitter_email,
    status: (r.status as CorrectionStatus) ?? "new",
    notes: r.notes,
  }));

  return { items, counts };
}

export async function updateCorrectionStatus(
  submissionId: string,
  status: CorrectionStatus,
  notes: string | null,
): Promise<void> {
  await query(
    `UPDATE \`${PROJECT}.${DATASET_CURATED}.corrections_submissions\`
        SET status = @status,
            notes  = COALESCE(@notes, notes)
      WHERE submission_id = @id`,
    { id: submissionId, status, notes },
  );
}

// ---------------------------------------------------------------------------
// Row adapters
// ---------------------------------------------------------------------------

type ReleaseHistoryRow = {
  release_set: string;
  release_date: { value: string } | string | null;
  is_ocr_source: boolean;
};

type RecordRow = {
  document_id: string;
  naid: string;
  title: string;
  description: string | null;
  record_group: string | null;
  agency: string | null;
  collection_name: string | null;
  start_date: { value: string } | string | null;
  end_date: { value: string } | string | null;
  release_date: { value: string } | string | null;
  release_set: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  digital_object_url: string | null;
  document_type: string | null;
  has_ocr: boolean | null;
  has_digital_object: boolean | null;
  num_pages: number | null;
  pages_released: number | null;
  withholding_status: string | null;
  release_history: ReleaseHistoryRow[] | null;
};

function readReleaseHistory(
  rows: ReleaseHistoryRow[] | null,
): ReleaseHistoryEntry[] {
  if (!rows) return [];
  return rows
    .map((r) => ({
      releaseSet: r.release_set,
      releaseDate:
        typeof r.release_date === "object" && r.release_date
          ? r.release_date.value
          : ((r.release_date as string | null) ?? null),
      isOcrSource: !!r.is_ocr_source,
    }))
    .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""));
}

function readDate(d: RecordRow["start_date"]): string | null {
  if (!d) return null;
  if (typeof d === "string") return d;
  return d.value ?? null;
}

function rowToCard(r: RecordRow, snippet?: string | null): DocumentCard {
  const date = readDate(r.start_date);
  const { title, sourceTitle } = documentDisplayFields({
    title: r.title,
    naid: r.naid,
    agency: r.agency,
    description: r.description,
    documentType: r.document_type,
  });
  return {
    id: r.document_id,
    naid: r.naid,
    title,
    sourceTitle,
    subtitle: r.record_group ?? null,
    snippet: snippet ?? r.description ?? null,
    href: `/document/${encodeURIComponent(r.document_id)}`,
    tags: compactTags(r),
    agency: r.agency,
    date,
    dateLabel: formatDate(date),
    documentType: r.document_type,
    hasOcr: !!r.has_ocr,
  };
}

function rowToDetail(
  r: RecordRow,
  ocr?: {
    chunkCount: number;
    firstChunk: string | null;
    hasOcrText: boolean;
    ocrPages?: OcrPage[];
    ocrBodyUnavailable?: boolean;
    ocrFirstChunkOrder?: number | null;
    ocrLastChunkOrder?: number | null;
    ocrPrevChunkOrder?: number | null;
    ocrNextChunkOrder?: number | null;
    ocrLastPageLabel?: string | null;
  },
): DocumentDetail {
  const card = rowToCard(r);
  return {
    ...card,
    description: r.description,
    recordGroup: r.record_group,
    collectionName: r.collection_name,
    startDate: readDate(r.start_date),
    endDate: readDate(r.end_date),
    sourceUrl: normalizeSourceUrl(r.source_url),
    digitalObjectUrl: normalizeSourceUrl(r.digital_object_url),
    thumbnailUrl: r.thumbnail_url,
    pageCount: r.num_pages ?? r.pages_released ?? null,
    chunkCount: ocr?.chunkCount ?? 0,
    ocrExcerpt: ocr?.firstChunk ?? null,
    ocrPages: ocr?.ocrPages,
    ocrBodyUnavailable: ocr?.ocrBodyUnavailable,
    ocrFirstChunkOrder: ocr?.ocrFirstChunkOrder,
    ocrLastChunkOrder: ocr?.ocrLastChunkOrder,
    ocrPrevChunkOrder: ocr?.ocrPrevChunkOrder,
    ocrNextChunkOrder: ocr?.ocrNextChunkOrder,
    ocrLastPageLabel: ocr?.ocrLastPageLabel,
    hasOcr: ocr?.hasOcrText ?? !!r.has_ocr,
    citation: r.record_group
      ? `NAID ${r.naid} · ${r.record_group}`
      : `NAID ${r.naid} · JFK Assassination Records Collection`,
    releaseHistory: readReleaseHistory(r.release_history),
  };
}

function recordDisplayTitle(r: {
  title?: string | null;
  naid?: string | null;
  document_id?: string;
  agency?: string | null;
  description?: string | null;
  document_type?: string | null;
}): string {
  return displayDocumentTitle({
    title: r.title,
    naid: r.naid ?? r.document_id ?? "",
    agency: r.agency,
    description: r.description,
    documentType: r.document_type,
  });
}

function compactTags(r: RecordRow): string[] {
  const tags: string[] = [];
  if (r.agency) tags.push(r.agency);
  if (r.document_type) tags.push(titleCase(r.document_type));
  if (r.release_set) tags.push(`Release ${r.release_set}`);
  return tags.slice(0, 4);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Entity / topic static metadata (seeded in BigQuery for consistency)
// ---------------------------------------------------------------------------

type EntityRow = {
  entity_id: string;
  entity_name: string;
  entity_type: "person" | "org" | "place" | "concept";
  aliases: string[];
  summary: string;
  description: string;
  headline: string | null;
  born: string | null;
  died: string | null;
  active_years: string | null;
  sort_order: number;
};

let cachedEntities: { expiresAt: number; rows: EntityRow[] } | null = null;

async function loadEntities(): Promise<EntityRow[]> {
  const now = Date.now();
  if (cachedEntities && cachedEntities.expiresAt > now) {
    return cachedEntities.rows;
  }
  const rows = await query<EntityRow>(
    `SELECT entity_id, entity_name, entity_type, aliases, summary,
            description, headline, born, died, active_years, sort_order
       FROM \`${PROJECT}.${DATASET_CURATED}.jfk_entities\`
      ORDER BY sort_order`,
  );
  cachedEntities = { rows, expiresAt: now + 5 * 60_000 };
  return rows;
}

function entityRowToDetail(
  r: EntityRow,
  counts: { documents: number; mentions: number },
): EntityDetail {
  return {
    slug: r.entity_id,
    name: r.entity_name,
    type: r.entity_type,
    summary: r.summary,
    description: r.description,
    headline: r.headline,
    aliases: r.aliases,
    born: r.born,
    died: r.died,
    activeYears: r.active_years,
    href: `/entity/${r.entity_id}`,
    documentCount: counts.documents,
    mentionCount: counts.mentions,
  };
}

function entityRowToCard(
  r: EntityRow,
  count?: { documents?: number; mentions?: number },
): EntityCard {
  return {
    slug: r.entity_id,
    name: r.entity_name,
    type: r.entity_type,
    summary: r.summary,
    href: `/entity/${r.entity_id}`,
    aliases: r.aliases,
    documentCount: count?.documents,
    mentionCount: count?.mentions,
  };
}

// ---------------------------------------------------------------------------
// Topic catalog (static per MVP; counts come from BigQuery)
// ---------------------------------------------------------------------------

const TOPIC_CATALOG: Record<
  string,
  {
    title: string;
    summary: string;
    description: string;
    eyebrow: string;
    mvpTable: string;
    relatedSlugs?: string[];
  }
> = {
  "warren-commission": {
    title: "Warren Commission",
    eyebrow: "1963 – 1964",
    summary:
      "Presidential commission led by Chief Justice Earl Warren that produced the first federal report on the assassination.",
    description:
      "The President's Commission on the Assassination of President Kennedy published its 888-page report on September 24, 1964, together with 26 volumes of hearings and exhibits. Its working files include staff memoranda, interview summaries, and unpublished exhibits held at the National Archives.",
    mvpTable: "warren_commission_docs",
    relatedSlugs: ["hsca", "fbi"],
  },
  hsca: {
    title: "House Select Committee on Assassinations",
    eyebrow: "1976 – 1979",
    summary:
      "Congressional re-investigation that examined acoustic, medical, and intelligence evidence a decade after the Warren Report.",
    description:
      "The House Select Committee on Assassinations issued a 686-page final report on March 29, 1979, alongside a 12-volume appendix. The Committee's working files, including counsel memoranda and staff interview notes, form one of the largest collections released under the JFK Records Act.",
    mvpTable: "hsca_docs",
    relatedSlugs: ["warren-commission", "cia"],
  },
  "mexico-city": {
    title: "Mexico City",
    eyebrow: "September – October 1963",
    summary:
      "Oswald's documented visit to Mexico City and the CIA station's surveillance of the Cuban and Soviet embassies.",
    description:
      "Oswald traveled to Mexico City between approximately September 27 and October 2, 1963, visiting the Cuban consulate and the Soviet embassy. CIA Mexico City station cables, telephone intercept summaries, and photographic surveillance logs related to this trip are among the most studied materials in the JFK Collection.",
    mvpTable: "mexico_city_docs",
    relatedSlugs: ["cia", "cuba"],
  },
  cia: {
    title: "CIA Records",
    eyebrow: "1959 – 1992",
    summary:
      "Agency records spanning Oswald's 201 file, the Directorate of Plans, and the Mexico City and Miami stations.",
    description:
      "CIA holdings released under the JFK Records Act include the 201 personality file opened on Oswald in December 1960, operational traffic from the Mexico City and Miami stations, and a substantial body of counterintelligence correspondence.",
    mvpTable: "cia_docs",
    relatedSlugs: ["mexico-city", "hsca"],
  },
  fbi: {
    title: "FBI Records",
    eyebrow: "1959 – 1978",
    summary:
      "Bureau files comprising the Oswald HQ and Dallas Field Office investigations and the Ruby case.",
    description:
      "FBI holdings in the JFK Collection include the Headquarters and Dallas Field Office Oswald files (FBIHQ 105-82555 and DL 100-10461), the Ruby file, thousands of FD-302 witness interview reports, and the director's own teletype and memorandum traffic.",
    mvpTable: "fbi_docs",
    relatedSlugs: ["warren-commission", "cia"],
  },
  cuba: {
    title: "Cuba & Cuban Exiles",
    eyebrow: "1961 – 1978",
    summary:
      "Records concerning Cuba, Fidel Castro, anti-Castro exile activity, and related Agency operations.",
    description:
      "Records touching on Cuba span the DRE and JURE exile groups, the Fair Play for Cuba Committee (FPCC), Agency Cuban operations out of JMWAVE in Miami, and subsequent congressional inquiries into U.S.-Cuban relations through the 1970s.",
    mvpTable: "cuba_docs",
    relatedSlugs: ["cia", "mexico-city"],
  },
  "tippit-murder": {
    title: "Tippit Murder",
    eyebrow: "November 22, 1963",
    summary:
      "Records examining the murder of Dallas Police Officer J. D. Tippit approximately 45 minutes after the assassination of President Kennedy.",
    description:
      "Dallas Police Officer J. D. Tippit was shot and killed at East 10th Street and Patton Avenue in Oak Cliff on November 22, 1963. Nine eyewitnesses later identified Lee Harvey Oswald as the gunman in lineups or photo arrays; Oswald was charged the same day with both the Tippit and Kennedy murders. The documentary record of the shooting is primarily examined in the Warren Commission, the HSCA, and the ARRB reports.",
    mvpTable: "tippit_murder_docs",
    relatedSlugs: ["warren-commission", "fbi", "dealey-plaza"],
  },
  "dealey-plaza": {
    title: "Dealey Plaza",
    eyebrow: "The scene",
    summary:
      "Records concerning the motorcade, Dealey Plaza geography, the Texas School Book Depository, the Zapruder film, and eyewitness accounts of the shooting scene.",
    description:
      "Dealey Plaza is the triangular plaza at the west end of downtown Dallas where President Kennedy was fatally shot on November 22, 1963. The principal shooting scene — the Texas School Book Depository, the grassy knoll, the triple underpass, and the surrounding witness positions — is documented across Warren Commission exhibits, HSCA photographic analysis, and the primary visual records (the Zapruder, Nix, Muchmore, and Moorman films and photographs).",
    mvpTable: "dealey_plaza_docs",
    relatedSlugs: ["warren-commission", "hsca", "physical-evidence"],
  },
  "church-committee": {
    title: "Church Committee",
    eyebrow: "1975 – 1976",
    summary:
      "The 1975–76 Senate Select Committee that examined CIA and FBI conduct in the JFK investigation and published Book V on the subject.",
    description:
      "The Senate Select Committee to Study Governmental Operations with Respect to Intelligence Activities, chaired by Senator Frank Church, published six books of its final report (S. Rep. No. 94-755) in April 1976. Book V, subtitled \"The Investigation of the Assassination of President John F. Kennedy: Performance of the Intelligence Agencies,\" is indexed as a primary-source report on this site.",
    mvpTable: "church_committee_docs",
    relatedSlugs: ["cia", "fbi", "hsca"],
  },
  "arrb-releases": {
    title: "ARRB & Declassification",
    eyebrow: "1992 – present",
    summary:
      "The Assassination Records Review Board (1994–98) and the ongoing declassification history of the JFK Assassination Records Collection.",
    description:
      "The JFK Records Act of 1992 established the JFK Assassination Records Collection at the National Archives and created the Assassination Records Review Board (ARRB), a five-member independent panel that oversaw declassification between 1994 and 1998. The collection has continued to open in tranches: 2017–18, 2021, 2022, 2023, the March and April 2025 EO 14176 drops, and the January 2026 release.",
    mvpTable: "arrb_releases_docs",
    relatedSlugs: ["warren-commission", "cia", "fbi"],
  },
  "mob-castro-plots": {
    title: "Organized Crime & Castro Plots",
    eyebrow: "AMLASH · ZRRIFLE · Mongoose",
    summary:
      "CIA operations against Fidel Castro and their organized-crime-intermediary angle — AMLASH, ZRRIFLE, Mongoose, and the mob figures Trafficante, Marcello, Giancana, and Roselli.",
    description:
      "The CIA's anti-Castro operations between 1960 and 1965 included direct assassination planning (AMLASH, ZRRIFLE) and the use of organized-crime intermediaries (Santo Trafficante Jr., Carlos Marcello, Sam Giancana, Johnny Roselli). The Church Committee examined this conduct in 1975–76; the HSCA revisited it in 1978–79. The records span CIA cable traffic, FBI surveillance files, and congressional testimony.",
    mvpTable: "mob_castro_plots_docs",
    relatedSlugs: ["cia", "cuba", "church-committee"],
  },
  "physical-evidence": {
    title: "Physical Evidence",
    eyebrow: "Ballistics · Firearms · Photographic · Medical",
    summary:
      "Hand-curated catalog of the physical evidence in the case — CE-399, the Carcano rifle, backyard photos, Zapruder film, Tippit shell casings, motorcade map, and more.",
    description:
      "The physical evidentiary record — the bullets, the rifle, the photographs, the clothing, and the scene itself — is cataloged in a dedicated surface at /evidence, with references to the Warren Commission exhibits, the HSCA medical and photographic panels, and the ARRB findings that examine each item.",
    mvpTable: "physical_evidence",
    relatedSlugs: ["dealey-plaza", "warren-commission", "hsca"],
  },
};

const TOPIC_DISPLAY_ORDER = [
  "warren-commission",
  "hsca",
  "mexico-city",
  "cia",
  "fbi",
  "cuba",
  "tippit-murder",
  "dealey-plaza",
  "church-committee",
  "arrb-releases",
  "mob-castro-plots",
  "physical-evidence",
];

// physical-evidence is a redirect-only topic — its counts come from
// jfk_curated.physical_evidence, not a jfk_mvp.* table. Any code that
// joins topic docs against the MVP layer MUST iterate this list
// instead of TOPIC_DISPLAY_ORDER to avoid querying a non-existent table.
const MVP_QUERYABLE_TOPIC_SLUGS = TOPIC_DISPLAY_ORDER.filter(
  (s) => s !== "physical-evidence",
);

function queryableTopicTables(): TopicTableRef[] {
  return MVP_QUERYABLE_TOPIC_SLUGS.map((slug) => ({
    slug,
    table: TOPIC_CATALOG[slug]!.mvpTable,
  }));
}

// ---------------------------------------------------------------------------
// HOME
// ---------------------------------------------------------------------------

export async function fetchHome(): Promise<HomeResponse> {
  if (useMockData()) return buildHomeResponse();

  const [stats, entities, topicCounts, recent, manifest] = await Promise.all([
    query<{ records: number; entities: number; mapped: number }>(
      `SELECT
        (SELECT COUNT(*) FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\`) AS records,
        (SELECT COUNT(*) FROM \`${PROJECT}.${DATASET_CURATED}.jfk_entities\`) AS entities,
        (SELECT COUNT(*) FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`) AS mapped`,
    ),
    loadEntities(),
    topicCountsMap(),
    query<RecordRow>(
      `SELECT r.* FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r
        WHERE r.start_date IS NOT NULL
          AND r.title IS NOT NULL
          AND NOT STARTS_WITH(LOWER(r.title), 'untitled')
          AND LENGTH(r.title) >= 20
          AND r.agency IS NOT NULL
          AND r.start_date BETWEEN DATE '1960-01-01' AND DATE '1980-01-01'
        ORDER BY r.release_date DESC, r.start_date DESC
        LIMIT 8`,
    ),
    fetchCorpusManifest(),
  ]);

  // Per-entity document counts
  const entityCounts = await query<{ entity_id: string; n: number }>(
    `SELECT entity_id, COUNT(*) AS n
       FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
      GROUP BY entity_id`,
  );
  const countByEntity = new Map(entityCounts.map((r) => [r.entity_id, r.n]));

  const FEATURED = ["oswald", "ruby", "cia", "fbi", "warren-commission", "hsca"];

  return {
    stats: {
      documentCount: stats[0]?.records ?? 0,
      mentionCount: stats[0]?.mapped ?? 0,
      entityCount: stats[0]?.entities ?? 0,
      topicCount: TOPIC_DISPLAY_ORDER.length,
    },
    featuredEntities: FEATURED.map((id) => entities.find((e) => e.entity_id === id))
      .filter((e): e is EntityRow => !!e)
      .map((e) =>
        entityRowToCard(e, {
          documents: countByEntity.get(e.entity_id) ?? 0,
          mentions: countByEntity.get(e.entity_id) ?? 0,
        }),
      ),
    featuredTopics: TOPIC_DISPLAY_ORDER.slice(0, 5).map((slug) =>
      topicToCard(slug, topicCounts.get(slug) ?? 0),
    ),
    recentDocuments: recent.map((r) => rowToCard(r)),
    corpusManifest: manifest,
  };
}

type ManifestRow = {
  total_records: number;
  records_with_ocr: number;
  ocr_passages: number;
  latest_indexed_release_date: { value: string } | string | null;
  has_2017_2018_release: boolean;
  has_2021_release: boolean;
  has_2022_release: boolean;
  has_2023_release: boolean;
  has_2025_release: boolean;
  has_2026_release: boolean;
  records_in_2017_2018: number;
  records_in_2021: number;
  records_in_2022: number;
  records_in_2023: number;
  records_in_2025: number;
  records_in_2026: number;
  records_with_2025_ocr: number;
};

export async function fetchCorpusManifest(): Promise<CorpusManifest> {
  if (useMockData()) return buildHomeResponse().corpusManifest;

  const rows = await query<ManifestRow>(
    `SELECT * FROM \`${PROJECT}.${DATASET_CURATED}.corpus_manifest\``,
  );
  const r = rows[0];
  if (!r) {
    return {
      totalRecords: 0,
      recordsWithOcr: 0,
      ocrPassages: 0,
      latestIndexedReleaseDate: null,
      releasesIndexed: [],
      releasesPending: [],
      recordsByRelease: {},
      recordsWith2025Ocr: 0,
      coverageNote: ocrCoverageSentence({
        totalRecords: 0,
        recordsWithOcr: 0,
        releasesIndexed: [],
        releasesPending: [],
      }),
    };
  }
  const knownReleases: { set: string; flag: boolean; count: number }[] = [
    { set: "2017-2018", flag: r.has_2017_2018_release, count: Number(r.records_in_2017_2018 ?? 0) },
    { set: "2021", flag: r.has_2021_release, count: Number(r.records_in_2021 ?? 0) },
    { set: "2022", flag: r.has_2022_release, count: Number(r.records_in_2022 ?? 0) },
    { set: "2023", flag: r.has_2023_release, count: Number(r.records_in_2023 ?? 0) },
    { set: "2025", flag: r.has_2025_release, count: Number(r.records_in_2025 ?? 0) },
    { set: "2026", flag: r.has_2026_release, count: Number(r.records_in_2026 ?? 0) },
  ];
  const latest = r.latest_indexed_release_date;
  const latestStr =
    typeof latest === "object" && latest ? latest.value : (latest as string | null);
  const recordsByRelease: Record<string, number> = {};
  for (const k of knownReleases) recordsByRelease[k.set] = k.count;
  const releasesIndexed = knownReleases.filter((k) => k.flag).map((k) => k.set);
  const releasesPending = knownReleases.filter((k) => !k.flag).map((k) => k.set);
  const totalRecords = Number(r.total_records ?? 0);
  const recordsWithOcr = Number(r.records_with_ocr ?? 0);
  return {
    totalRecords,
    recordsWithOcr,
    ocrPassages: Number(r.ocr_passages ?? 0),
    latestIndexedReleaseDate: latestStr ?? null,
    releasesIndexed,
    releasesPending,
    recordsByRelease,
    recordsWith2025Ocr: Number(r.records_with_2025_ocr ?? 0),
    coverageNote: ocrCoverageSentence({
      totalRecords,
      recordsWithOcr,
      releasesIndexed,
      releasesPending,
    }),
  };
}

export async function fetchMediaIndex(): Promise<MediaIndexResponse> {
  return buildMediaIndexResponse();
}

async function topicCountsMap(): Promise<Map<string, number>> {
  // physical-evidence is the only non-MVP-backed topic — count it separately
  // from jfk_curated.physical_evidence (see MVP_QUERYABLE_TOPIC_SLUGS).
  const qs = MVP_QUERYABLE_TOPIC_SLUGS
    .map(
      (slug) =>
        `SELECT '${slug}' AS slug, COUNT(*) AS n FROM \`${PROJECT}.${DATASET_MVP}.${TOPIC_CATALOG[slug]!.mvpTable}\``,
    )
    .join(" UNION ALL ");
  const rows = await query<{ slug: string; n: number }>(qs);
  const out = new Map(rows.map((r) => [r.slug, r.n]));
  if (TOPIC_DISPLAY_ORDER.includes("physical-evidence")) {
    const peRows = await query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM \`${PROJECT}.${DATASET_CURATED}.physical_evidence\``,
    ).catch(() => []);
    out.set("physical-evidence", peRows[0]?.n ?? 0);
  }
  return out;
}

let cachedTopicCounts: { expiresAt: number; counts: Map<string, number> } | null = null;

async function getTopicCountsCached(): Promise<Map<string, number>> {
  const now = Date.now();
  if (cachedTopicCounts && cachedTopicCounts.expiresAt > now) {
    return cachedTopicCounts.counts;
  }

  const counts = await topicCountsMap();
  cachedTopicCounts = { counts, expiresAt: now + 5 * 60_000 };
  return counts;
}

function topicToCard(slug: string, count: number): TopicCard {
  const t = TOPIC_CATALOG[slug]!;
  return {
    slug,
    title: t.title,
    summary: t.summary,
    documentCount: count,
    href: `/topic/${slug}`,
    eyebrow: t.eyebrow,
  };
}

export async function fetchAllTopics(): Promise<TopicCard[]> {
  if (useMockData()) return listMockTopics().map(mockTopicToCard);

  const counts = await topicCountsMap();
  return TOPIC_DISPLAY_ORDER.map((slug) =>
    topicToCard(slug, counts.get(slug) ?? 0),
  );
}

export async function fetchAllEntities(): Promise<EntityCard[]> {
  if (useMockData()) return listMockEntities().map(mockEntityToCard);

  const entities = await loadEntities();
  const counts = await query<{ entity_id: string; n: number }>(
    `SELECT entity_id, COUNT(*) AS n
       FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
      GROUP BY entity_id`,
  );
  const countByEntity = new Map(counts.map((r) => [r.entity_id, r.n]));
  return entities
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) =>
      entityRowToCard(e, {
        mentions: countByEntity.get(e.entity_id) ?? 0,
        documents: countByEntity.get(e.entity_id) ?? 0,
      }),
    );
}

// ---------------------------------------------------------------------------
// ENTITY
// ---------------------------------------------------------------------------

export async function fetchEntity(slug: string): Promise<EntityResponse | null> {
  if (useMockData()) return buildEntityResponse(slug);

  const entities = await loadEntities();
  const entity = entities.find((e) => e.entity_id === slug);
  if (!entity) return null;

  const [docRows, entityDocCount, coOccurrence, sourceRows, factRows, timelineRows] = await Promise.all([
    query<RecordRow & { confidence: ConfidenceLevel; match_source: string; score: number }>(
      `SELECT r.*, m.confidence, m.match_source, m.score
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r
         JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\` m
           USING (document_id)
        WHERE m.entity_id = @slug
        ORDER BY m.score DESC, r.start_date DESC
        LIMIT 12`,
      { slug },
    ),
    query<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
        WHERE entity_id = @slug`,
      { slug },
    ),
    query<{ entity_id: string; n: number }>(
      `WITH docs AS (
         SELECT document_id
           FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
          WHERE entity_id = @slug
       )
       SELECT m.entity_id, COUNT(*) AS n
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\` m
         JOIN docs USING (document_id)
        WHERE m.entity_id != @slug
        GROUP BY m.entity_id
        ORDER BY n DESC
        LIMIT 6`,
      { slug },
    ),
    query<{
      label: string;
      url: string | null;
      kind: string;
      note: string | null;
    }>(
      `SELECT label, url, kind, note
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_entity_sources\`
        WHERE entity_id = @slug
        ORDER BY sort_order`,
      { slug },
    ).catch(() => []),
    query<{
      fact_key: string;
      fact_value: string;
      effective_date: { value: string } | string | null;
      source_type: string;
      source_ref: string;
      confidence: string;
    }>(
      `SELECT fact_key, fact_value, effective_date, source_type,
              source_ref, confidence
         FROM \`${PROJECT}.${DATASET_CURATED}.entity_facts\`
        WHERE entity_id = @slug
        ORDER BY sort_order`,
      { slug },
    ).catch(() => []),
    query<{
      event_id: string;
      event_date: { value: string } | string;
      event_time_local: string | null;
      title: string;
      description: string;
    }>(
      `SELECT event_id, event_date, event_time_local, title, description
         FROM \`${PROJECT}.${DATASET_CURATED}.timeline_events\`
        WHERE @slug IN UNNEST(related_entity_ids)
        ORDER BY event_date, event_time_local NULLS FIRST`,
      { slug },
    ).catch(() => []),
  ]);

  const sources: EntitySource[] = sourceRows.map((s) => ({
    label: s.label,
    url: s.url,
    kind: s.kind,
    note: s.note,
  }));

  const timelineEvents: TimelineEvent[] = timelineRows.map((r) => {
    const dateStr =
      typeof r.event_date === "object" ? r.event_date.value : r.event_date;
    const base = formatDate(dateStr) ?? dateStr;
    const dateLabel = r.event_time_local
      ? `${base} (${r.event_time_local})`
      : base;
    return {
      id: r.event_id,
      date: dateStr,
      dateLabel,
      title: r.title,
      description: r.description,
    };
  });

  const facts: EntityFact[] = factRows.map((f) => ({
    key: f.fact_key,
    value: f.fact_value,
    effectiveDate:
      typeof f.effective_date === "object" && f.effective_date
        ? f.effective_date.value
        : ((f.effective_date as string | null) ?? null),
    sourceType: f.source_type,
    sourceRef: f.source_ref,
    confidence:
      f.confidence === "High" || f.confidence === "Medium" || f.confidence === "Low"
        ? f.confidence
        : "Medium",
  }));

  const docCount = entityDocCount[0]?.n ?? 0;

  // Pull real OCR passages for this entity across its top documents.
  const ocrExcerpts = await query<{
    document_id: string;
    chunk_id: string;
    chunk_order: number;
    chunk_text: string;
    page_label: string | null;
  }>(
    `WITH alias_regex AS (
       SELECT (SELECT STRING_AGG(
                  REGEXP_REPLACE(alias, r'([.\\\\+*?\\[\\]{}()|^$])', r'\\\\\\1'),
                  '|')
                 FROM \`${PROJECT}.${DATASET_CURATED}.jfk_entities\` e,
                 UNNEST(e.aliases) alias
                 WHERE e.entity_id = @slug) AS alternation
     ),
     ranked AS (
       SELECT
         c.document_id, c.chunk_id, c.chunk_order, c.chunk_text, c.page_label,
         ROW_NUMBER() OVER (PARTITION BY c.document_id ORDER BY c.chunk_order) AS rn
       FROM \`${PROJECT}.${DATASET_CURATED}.jfk_text_chunks\` c, alias_regex
       WHERE c.source_type IN ('abbyy_ocr', 'docai_ocr')
         AND REGEXP_CONTAINS(LOWER(c.chunk_text), CONCAT(r'\\b(', alternation, r')\\b'))
     )
     SELECT document_id, chunk_id, chunk_order, chunk_text, page_label
       FROM ranked WHERE rn = 1
      LIMIT 12`,
    { slug },
  );
  const excerptByDoc = new Map(ocrExcerpts.map((e) => [e.document_id, e]));

  const mentionExcerpts: MentionExcerpt[] = docRows.slice(0, 10).map((r) => {
    const ocr = excerptByDoc.get(r.document_id);
    if (ocr) {
      return {
        id: `m-ocr-${r.document_id}`,
        documentId: r.document_id,
        documentTitle: recordDisplayTitle(r),
        documentHref: documentReaderHref(r.document_id, ocr.chunk_order),
        excerpt: truncateAround(ocr.chunk_text, entity.aliases, 260),
        matchedTerms: entity.aliases.slice(0, 3),
        confidence: (r.confidence as ConfidenceLevel) ?? "low",
        source: "ocr",
        pageLabel: ocr.page_label,
        chunkOrder: ocr.chunk_order,
      };
    }
    return {
      id: `m-${r.document_id}`,
      documentId: r.document_id,
      documentTitle: recordDisplayTitle(r),
      documentHref: `/document/${encodeURIComponent(r.document_id)}`,
      excerpt: r.description || recordDisplayTitle(r),
      matchedTerms: entity.aliases.slice(0, 3),
      confidence: (r.confidence as ConfidenceLevel) ?? "medium",
      source:
        r.match_source === "title"
          ? "title"
          : r.match_source === "description"
            ? "description"
            : "description",
      pageLabel: null,
    };
  });

  const relatedEntities: EntityCard[] = coOccurrence
    .map((c) => {
      const e = entities.find((x) => x.entity_id === c.entity_id);
      return e ? entityRowToCard(e, { mentions: c.n }) : null;
    })
    .filter((e): e is EntityCard => !!e);

  // Topic relation: count topic-table membership for this entity's documents.
  const topicCoOccurrence = await Promise.all(
    MVP_QUERYABLE_TOPIC_SLUGS.map(async (topicSlug) => {
      const t = TOPIC_CATALOG[topicSlug]!;
      const rows = await query<{ n: number }>(
        `SELECT COUNT(*) AS n
           FROM \`${PROJECT}.${DATASET_MVP}.${t.mvpTable}\` t
           JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\` m
             USING (document_id)
          WHERE m.entity_id = @slug`,
        { slug },
      );
      return { slug: topicSlug, n: rows[0]?.n ?? 0 };
    }),
  );
  const relatedTopics: TopicCard[] = topicCoOccurrence
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((t) => topicToCard(t.slug, t.n));

  return {
    entity: entityRowToDetail(entity, { documents: docCount, mentions: docCount }),
    timeline: timelineEvents,
    relatedTopics,
    relatedEntities,
    topDocuments: docRows.slice(0, 10).map((r) => rowToCard(r)),
    mentionExcerpts,
    sources,
    facts,
  };
}

// ---------------------------------------------------------------------------
// TOPIC
// ---------------------------------------------------------------------------

export async function fetchTopic(slug: string): Promise<TopicResponse | null> {
  if (useMockData()) return buildTopicResponse(slug);

  const t = TOPIC_CATALOG[slug];
  if (!t) return null;

  const [docs, count, entityCoOcc, aiRows, articleRows, addendaRows] = await Promise.all([
    query<RecordRow>(
      `SELECT r.*
         FROM \`${PROJECT}.${DATASET_MVP}.${t.mvpTable}\` r
        WHERE r.title IS NOT NULL
        ORDER BY r.start_date DESC NULLS LAST, r.pages_released DESC NULLS LAST
        LIMIT 10`,
    ),
    query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM \`${PROJECT}.${DATASET_MVP}.${t.mvpTable}\``,
    ),
    query<{ entity_id: string; n: number }>(
      `SELECT m.entity_id, COUNT(*) AS n
         FROM \`${PROJECT}.${DATASET_MVP}.${t.mvpTable}\` r
         JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\` m
           USING (document_id)
        GROUP BY m.entity_id
        ORDER BY n DESC
        LIMIT 6`,
    ),
    query<{
      summary: string;
      model: string;
      generated_at: { value: string } | string;
      source_doc_count: number;
    }>(
      `SELECT summary, model, generated_at, source_doc_count
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_topic_summaries\`
        WHERE slug = @slug`,
      { slug },
    ).catch(() => []),
    query<{
      article: string;
      model: string;
      generated_at: { value: string } | string;
      source_doc_count: number;
    }>(
      `SELECT article, model, generated_at, source_doc_count
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_topic_articles\`
        WHERE slug = @slug`,
      { slug },
    ).catch(() => []),
    query<{
      release_set: string;
      article: string;
      model: string;
      generated_at: { value: string } | string;
      source_doc_count: number;
    }>(
      `SELECT release_set, article, model, generated_at, source_doc_count
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_topic_release_addenda\`
        WHERE slug = @slug
        ORDER BY release_set DESC`,
      { slug },
    ).catch(() => []),
  ]);

  const entities = await loadEntities();
  const relatedEntities = entityCoOcc
    .map((c) => {
      const e = entities.find((x) => x.entity_id === c.entity_id);
      return e ? entityRowToCard(e, { mentions: c.n }) : null;
    })
    .filter((e): e is EntityCard => !!e);

  const mentionExcerpts: MentionExcerpt[] = docs.slice(0, 6).map((r) => ({
    id: `m-${r.document_id}`,
    documentId: r.document_id,
    documentTitle: recordDisplayTitle(r),
    documentHref: `/document/${encodeURIComponent(r.document_id)}`,
    excerpt: r.description || recordDisplayTitle(r),
    matchedTerms: [t.title],
    confidence: "medium",
    source: "description",
    pageLabel: null,
  }));

  const ai = aiRows[0];
  const art = articleRows[0];
  const topic: TopicDetail = {
    slug,
    title: t.title,
    summary: t.summary,
    description: t.description,
    documentCount: count[0]?.n ?? 0,
    href: `/topic/${slug}`,
    eyebrow: t.eyebrow,
    relatedSlugs: t.relatedSlugs,
    aiSummary: ai?.summary
      ? {
          text: ai.summary,
          model: ai.model,
          generatedAt:
            typeof ai.generated_at === "string"
              ? ai.generated_at
              : ai.generated_at.value,
          sourceDocCount: ai.source_doc_count,
        }
      : undefined,
    aiArticle: art?.article
      ? {
          text: art.article,
          model: art.model,
          generatedAt:
            typeof art.generated_at === "string"
              ? art.generated_at
              : art.generated_at.value,
          sourceDocCount: art.source_doc_count,
        }
      : undefined,
  };

  const releaseAddenda = addendaRows.map((r) => ({
    releaseSet: r.release_set,
    releaseLabel: releaseLabelFor(r.release_set),
    text: r.article,
    model: r.model,
    generatedAt:
      typeof r.generated_at === "string" ? r.generated_at : r.generated_at.value,
    sourceDocCount: r.source_doc_count,
  }));

  return {
    topic,
    relatedEntities,
    topDocuments: docs.map((r) => rowToCard(r)),
    mentionExcerpts,
    releaseAddenda,
  };
}

function releaseLabelFor(releaseSet: string): string {
  switch (releaseSet) {
    case "2017-2018":
      return "2017–2018 release";
    case "2021":
      return "October 2021 release";
    case "2022":
      return "2022 release";
    case "2023":
      return "2023 release";
    case "2025":
      return "2025 release";
    default:
      return `${releaseSet} release`;
  }
}

// ---------------------------------------------------------------------------
// DOCUMENT
// ---------------------------------------------------------------------------

export type FetchDocumentOptions = {
  /** When set, load that OCR page instead of the first page. */
  chunkOrder?: number | null;
};

export async function fetchDocument(
  id: string,
  options: FetchDocumentOptions = {},
): Promise<DocumentResponse | null> {
  if (useMockData()) return buildDocumentResponse(id);

  return withDocumentCache(
    documentCacheKey(id, options.chunkOrder),
    () => loadWarehouseDocument(id, options),
    {
      aliasKeys: (result) => [
        documentCacheKey(result.document.id, options.chunkOrder),
        documentCacheKey(result.document.naid, options.chunkOrder),
      ],
    },
  );
}

type DocumentMapRow = {
  entity_id: string;
  confidence: ConfidenceLevel;
  match_source: string;
};

type DocumentBundleRow = RecordRow & {
  map_rows?: DocumentMapRow[] | null;
  related_rows?: RecordRow[] | null;
  topic_slugs?: string[] | null;
  ocr_meta?: OcrPageMetaRecord | null;
};

async function loadWarehouseDocument(
  id: string,
  options: FetchDocumentOptions,
): Promise<DocumentResponse | null> {
  const bundle = await loadDocumentReadBundle(id);
  if (!bundle) return null;
  const doc = bundle;
  const canonicalId = doc.document_id;
  const mapRows = Array.isArray(doc.map_rows) ? doc.map_rows : [];
  const related = Array.isArray(doc.related_rows) ? doc.related_rows : [];
  const bundledTopics = Array.isArray(doc.topic_slugs);
  const bundledOcrMeta = Object.prototype.hasOwnProperty.call(doc, "ocr_meta");

  const [ocrBody, relatedTopics] = await Promise.all([
    bundledOcrMeta
      ? fetchDocumentOcrFirstPageFromMeta(
          canonicalId,
          doc.ocr_meta ? normalizePageMeta(doc.ocr_meta) : null,
          options.chunkOrder,
        )
      : fetchDocumentOcrFirstPage(canonicalId, options.chunkOrder),
    bundledTopics
      ? topicCardsFromSlugs(doc.topic_slugs ?? [])
      : fetchDocumentTopics(canonicalId),
  ]);

  const entities = await loadEntities();
  const relatedEntities = mapRows
    .map((m) => {
      const e = entities.find((x) => x.entity_id === m.entity_id);
      return e ? entityRowToCard(e) : null;
    })
    .filter((e): e is EntityCard => !!e);

  const loadedPage = ocrBody.kind === "page" ? ocrBody.page : null;
  const hasOcrText = loadedPage !== null;
  const ocrBodyUnavailable =
    ocrBody.kind === "unavailable" ||
    (ocrBody.kind === "none" && !!doc.has_ocr);
  const hasOcr = hasOcrText || !!doc.has_ocr;

  // Mentions are matched against the currently loaded page only. Do not
  // invent file-wide passage hits from title/description leftovers, and
  // do not scan the fat OCR body for every mention in this file.
  const mentions: MentionExcerpt[] = [];

  for (const m of mapRows) {
    if (!loadedPage) break;
    const e = entities.find((x) => x.entity_id === m.entity_id);
    const aliases = e?.aliases ?? [];
    const aliasRe = buildAliasRegex(aliases);
    if (!aliasRe || !aliasRe.test(loadedPage.chunk_text)) continue;
    mentions.push({
      id: `m-${m.entity_id}-${loadedPage.chunk_id}`,
      documentId: canonicalId,
      documentTitle: recordDisplayTitle(doc),
      documentHref: documentReaderHref(canonicalId, loadedPage.chunk_order),
      excerpt: truncateAround(loadedPage.chunk_text, aliases, 280),
      matchedTerms: aliases.slice(0, 3),
      confidence: m.confidence,
      source: "ocr",
      pageLabel: loadedPage.page_label,
      chunkOrder: loadedPage.chunk_order,
    });
  }

  return {
    document: rowToDetail(doc, {
      chunkCount: ocrBody.kind === "page" ? ocrBody.meta.chunk_count : 0,
      firstChunk: loadedPage?.chunk_text ?? null,
      hasOcrText: hasOcr,
      ocrPages: loadedPage
        ? [
            {
              pageLabel: loadedPage.page_label || `chunk ${loadedPage.chunk_order}`,
              text: loadedPage.chunk_text,
              chunkOrder: loadedPage.chunk_order,
            },
          ]
        : undefined,
      ocrBodyUnavailable: ocrBodyUnavailable && !hasOcrText,
      ocrFirstChunkOrder:
        ocrBody.kind === "page" ? ocrBody.meta.first_chunk_order : null,
      ocrLastChunkOrder:
        ocrBody.kind === "page" ? ocrBody.meta.last_chunk_order : null,
      ocrPrevChunkOrder: loadedPage?.prev_chunk_order ?? null,
      ocrNextChunkOrder: loadedPage?.next_chunk_order ?? null,
      ocrLastPageLabel: ocrBody.kind === "page" ? ocrBody.lastPageLabel : null,
    }),
    mentions: mentions.slice(0, 8),
    relatedTopics,
    relatedEntities,
    relatedDocuments: related.map((r) => rowToCard(r)),
  };
}

async function loadDocumentReadBundle(
  id: string,
): Promise<DocumentBundleRow | null> {
  try {
    const rows = await query<DocumentBundleRow>(
      buildDocumentReadBundleSql(WAREHOUSE_TABLES),
      { id },
    );
    return rows[0] ?? null;
  } catch (error) {
    if (isBigQueryNotFound(error) || isBigQueryBytesBilledExceeded(error)) {
      console.warn(
        "[warehouse] document read bundle optional tables unavailable; using core bundle",
      );
      const rows = await query<DocumentBundleRow>(
        buildDocumentReadCoreSql(WAREHOUSE_TABLES),
        { id },
      );
      return rows[0] ?? null;
    }
    throw error;
  }
}

async function topicCardsFromSlugs(slugs: string[]): Promise<TopicCard[]> {
  const counts = await getThinTopicCountsCached();
  const ordered = sortTopicSlugsByDisplayOrder(
    slugs.filter(
      (slug): slug is string =>
        Boolean(slug && MVP_QUERYABLE_TOPIC_SLUGS.includes(slug)),
    ),
    TOPIC_DISPLAY_ORDER,
  );
  return ordered.map((slug) => topicToCard(slug, counts.get(slug) ?? 0));
}

const DOCUMENT_SITEMAP_TTL_MS = 24 * 60 * 60 * 1000;
const DOCUMENT_SITEMAP_ERROR_TTL_MS = 5 * 60 * 1000;

let documentSitemapCache: { expiresAt: number; ids: string[] } | null = null;

/**
 * Document IDs for the public sitemap.
 *
 * ID-only read of `jfk_records` (no OCR/chunk scan). Cached in-process so
 * crawler hits to /sitemap.xml do not re-query BigQuery on every request.
 *
 * @returns Canonical document_id values, or an empty list when the warehouse
 *   is unavailable.
 */
export async function fetchDocumentSitemapIds(): Promise<string[]> {
  if (useMockData()) {
    return listMockDocuments().map((doc) => doc.id);
  }

  const now = Date.now();
  if (documentSitemapCache && documentSitemapCache.expiresAt > now) {
    return documentSitemapCache.ids;
  }

  try {
    const rows = await query<{ document_id: string }>(
      `SELECT document_id
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\`
        WHERE document_id IS NOT NULL`,
    );
    const ids = rows
      .map((row) => row.document_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    documentSitemapCache = {
      ids,
      expiresAt: now + DOCUMENT_SITEMAP_TTL_MS,
    };
    return ids;
  } catch (error) {
    console.error("fetchDocumentSitemapIds failed", error);
    if (documentSitemapCache) return documentSitemapCache.ids;
    documentSitemapCache = {
      ids: [],
      expiresAt: now + DOCUMENT_SITEMAP_ERROR_TTL_MS,
    };
    return [];
  }
}

/** Clears the in-process document sitemap cache. Used by tests. */
export function clearDocumentSitemapCacheForTests(): void {
  documentSitemapCache = null;
}

export async function fetchCompare(recordId: string): Promise<CompareResponse | null> {
  if (useMockData()) return buildCompareResponse(recordId);

  // The compare surface needs per-release OCR and source-file provenance
  // before warehouse-backed diffs can be trusted. Keep live mode explicit
  // until those tables exist.
  return null;
}

let thinTopicCountsCache: { expiresAt: number; counts: Map<string, number> } | null =
  null;

async function getThinTopicCountsCached(): Promise<Map<string, number>> {
  const now = Date.now();
  if (thinTopicCountsCache && thinTopicCountsCache.expiresAt > now) {
    return thinTopicCountsCache.counts;
  }
  try {
    const rows = await query<{ slug: string; n: number }>(
      buildDocumentTopicCountSql(WAREHOUSE_TABLES),
    );
    const counts = new Map(rows.map((row) => [row.slug, Number(row.n) || 0]));
    thinTopicCountsCache = { counts, expiresAt: now + 5 * 60_000 };
    return counts;
  } catch (error) {
    if (isBigQueryNotFound(error) || isBigQueryBytesBilledExceeded(error)) {
      console.warn(
        "[warehouse] document_topic_map counts unavailable; topic chips keep slugs without fat COUNT",
      );
      return new Map();
    }
    throw error;
  }
}

async function fetchDocumentTopics(id: string): Promise<TopicCard[]> {
  try {
    const [rows, counts] = await Promise.all([
      query<{ slug: string }>(buildDocumentTopicSlugsSql(WAREHOUSE_TABLES), {
        id,
      }),
      getThinTopicCountsCached(),
    ]);
    const slugs = sortTopicSlugsByDisplayOrder(
      rows
        .map((row) => row.slug)
        .filter((slug): slug is string =>
          Boolean(slug && MVP_QUERYABLE_TOPIC_SLUGS.includes(slug)),
        ),
      TOPIC_DISPLAY_ORDER,
    );
    return slugs.map((slug) => topicToCard(slug, counts.get(slug) ?? 0));
  } catch (error) {
    if (isBigQueryNotFound(error) || isBigQueryBytesBilledExceeded(error)) {
      console.warn(
        "[warehouse] document_topic_map unavailable; document topics empty (no mvp-docs fallback)",
      );
      return [];
    }
    throw error;
  }
}

function buildAliasRegex(aliases: string[]): RegExp | null {
  const cleaned = aliases
    .map((a) => a.trim())
    .filter((a) => a.length >= 2)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (cleaned.length === 0) return null;
  return new RegExp(`\\b(${cleaned.join("|")})\\b`, "i");
}

function truncateAround(text: string, aliases: string[], budget: number): string {
  const re = buildAliasRegex(aliases);
  if (!re) return text.slice(0, budget);
  const match = re.exec(text);
  if (!match) return text.slice(0, budget);
  const idx = match.index;
  const half = Math.floor(budget / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(text.length, idx + match[0].length + half);
  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  return (start > 0 ? "… " : "") + slice + (end < text.length ? " …" : "");
}

// ---------------------------------------------------------------------------
// SEARCH
// ---------------------------------------------------------------------------

type WarehouseSearchInput = {
  query: string;
  mode: "document" | "mention" | "semantic";
  filters?: SearchFilterInput;
  limit?: number;
  /** Document and mention modes. Semantic ignores this. */
  offset?: number;
};

export async function fetchSearch(
  input: WarehouseSearchInput,
): Promise<SearchResponse> {
  return withSearchCache(
    searchCacheKey(input),
    () => fetchSearchUncached(input),
  );
}

async function fetchSearchUncached({
  query: q,
  mode,
  filters = {},
  limit = 50,
  offset = 0,
}: WarehouseSearchInput): Promise<SearchResponse> {
  if (useMockData()) {
    return buildSearchResponse({ query: q, mode, filters, limit, offset });
  }

  filters = searchFiltersForMode(mode, filters);
  const qNorm = q.trim();
  if (!qNorm && !hasWarehouseSearchFilters(filters)) {
    const facets = await loadSearchFacets(qNorm, filters);
    return {
      query: "",
      mode,
      total: 0,
      filters: facets,
      results: [],
    };
  }

  if (mode === "semantic") {
    return fetchSemanticSearch({ query: qNorm, filters, limit });
  }
  if (mode === "mention") {
    return fetchMentionSearch({
      query: qNorm,
      filters,
      limit,
      offset,
    });
  }
  if (isArchiveIdentifierQuery(qNorm)) {
    const identifierResult = await fetchIdentifierSearch({
      query: qNorm,
      filters,
      limit,
      offset,
    });
    if (identifierResult.total > 0) return identifierResult;
  }
  const params: Record<string, unknown> = {
    qNorm,
    qLike: qNorm ? `%${qNorm.toLowerCase()}%` : "%",
    ocrHitIds: [] as string[],
  };

  const where: string[] = [];
  // match_confidence is NULL when the query is empty; this clause also
  // enforces "must actually match the query" when a query is present.
  if (qNorm) where.push("match_confidence IS NOT NULL");

  if (filters.confidence?.length) {
    where.push(qNorm ? "match_confidence IN UNNEST(@confidences)" : "FALSE");
    params.confidences = filters.confidence;
  }

  if (filters.agencies?.length) {
    where.push("agency IN UNNEST(@agencies)");
    params.agencies = filters.agencies;
  }
  if (typeof filters.yearFrom === "number") {
    where.push("EXTRACT(YEAR FROM start_date) >= @yearFrom");
    params.yearFrom = filters.yearFrom;
  }
  if (typeof filters.yearTo === "number") {
    where.push("EXTRACT(YEAR FROM start_date) <= @yearTo");
    params.yearTo = filters.yearTo;
  }
  if (filters.entities?.length) {
    where.push(`document_id IN (
      SELECT document_id FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
      WHERE entity_id IN UNNEST(@entities)
    )`);
    params.entities = filters.entities;
  }
  if (filters.topics?.length) {
    // physical-evidence has no jfk_mvp.* table — it redirects to /evidence
    // and is not a documentary topic. An unsupported-only selection matches
    // no documents while remaining visible in the UI so it can be cleared.
    const unionSql = topicDocumentUnionSql(filters.topics);
    where.push(unionSql ? `document_id IN (${unionSql})` : "FALSE");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const ocrHitIds = qNorm ? await fetchOcrHitDocumentIds(qNorm) : [];
  params.ocrHitIds = ocrHitIds;

  const [results, filterData] = await Promise.all([
    query<
      RecordRow & {
        match_confidence: ConfidenceLevel | null;
        total_count: number;
      }
    >(
      buildDocumentSearchSql(
        WAREHOUSE_TABLES,
        whereSql,
        Number(limit),
        Number(offset),
      ),
      params,
    ),
    loadSearchFacets(qNorm, filters, ocrHitIds),
  ]);

  const total =
    results[0]?.total_count ??
    (offset > 0
      ? (
          await query<{ n: number }>(
            buildDocumentSearchCountSql(WAREHOUSE_TABLES, whereSql),
            params,
          )
        )[0]?.n ?? 0
      : 0);

  const snippets = await fetchOcrSnippets(
    results.map((row) => row.document_id),
    params.qLike as string,
  );

  const docResults: SearchResult[] = results.map((r) => {
    const snippet = snippets.get(r.document_id)
      ? truncateAround(snippets.get(r.document_id)!, [qNorm], 260)
      : undefined;
    return {
      kind: "document",
      document: rowToCard(r, snippet),
      mentionCount: 0,
      confidence: (r.match_confidence ?? "none") as ConfidenceLevel,
    };
  });

  return {
    query: qNorm,
    mode: "document",
    total,
    filters: filterData,
    results: docResults,
  };
}

// ---------------------------------------------------------------------------
// SEMANTIC SEARCH — Phase 5-A. Embeds the query with RETRIEVAL_QUERY task
// type and runs VECTOR_SEARCH against the chunk_embeddings table built by
// sql/31. Returns MentionExcerpt-shaped results so the existing search UI
// can render them without a new card component; the `score` field carries
// the cosine-based relevance (1 - distance), higher = better.
// ---------------------------------------------------------------------------

async function fetchMentionSearch({
  query: qNorm,
  filters,
  limit,
  offset,
}: {
  query: string;
  filters: SearchFilterInput;
  limit: number;
  offset: number;
}): Promise<SearchResponse> {
  if (!qNorm) {
    return {
      query: "",
      mode: "mention",
      total: 0,
      filters: await loadSearchFacets(qNorm, filters),
      results: [],
    };
  }

  const params: Record<string, unknown> = {};
  const mentionWhere: string[] = [];
  if (filters.agencies?.length) {
    mentionWhere.push("r.agency IN UNNEST(@agencies)");
    params.agencies = filters.agencies;
  }
  if (typeof filters.yearFrom === "number") {
    mentionWhere.push("EXTRACT(YEAR FROM r.start_date) >= @yearFrom");
    params.yearFrom = filters.yearFrom;
  }
  if (typeof filters.yearTo === "number") {
    mentionWhere.push("EXTRACT(YEAR FROM r.start_date) <= @yearTo");
    params.yearTo = filters.yearTo;
  }
  if (filters.entities?.length) {
    mentionWhere.push(`r.document_id IN (
      SELECT document_id FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
      WHERE entity_id IN UNNEST(@entities)
    )`);
    params.entities = filters.entities;
  }
  if (filters.topics?.length) {
    const unionSql = topicDocumentUnionSql(filters.topics);
    mentionWhere.push(unionSql ? `r.document_id IN (${unionSql})` : "FALSE");
  }
  const mentionWhereSql = mentionWhere.join(" AND ");

  const ocrHitIds = await fetchOcrHitDocumentIds(qNorm);
  const [ocrRows, facets] = await Promise.all([
    fetchMentionRows({
      whereSql: mentionWhereSql,
      documentIds: ocrHitIds,
      params,
      limit,
      offset,
    }),
    loadSearchFacets(qNorm, filters, ocrHitIds),
  ]);

  const total =
    ocrRows[0]?.total_count ??
    (offset > 0
      ? await fetchMentionTotal(mentionWhereSql, ocrHitIds, params)
      : 0);
  const results: SearchResult[] = ocrRows.map((row) => ({
    kind: "mention",
    mention: {
      id: `mx-${row.chunk_id}`,
      documentId: row.document_id,
      documentTitle: recordDisplayTitle(row),
      documentHref: documentReaderHref(row.document_id, row.chunk_order),
      excerpt: truncateAround(row.chunk_text, [qNorm], 280),
      matchedTerms: [qNorm],
      confidence: "low",
      source: "ocr",
      pageLabel: row.page_label,
      chunkOrder: row.chunk_order,
    },
  }));

  return {
    query: qNorm,
    mode: "mention",
    total,
    filters: facets,
    results,
  };
}

async function fetchIdentifierSearch({
  query: qNorm,
  filters,
  limit,
  offset,
}: {
  query: string;
  filters: SearchFilterInput;
  limit: number;
  offset: number;
}): Promise<SearchResponse> {
  const params: Record<string, unknown> = { qNorm };
  const where = [
    "(r.document_id = @qNorm OR CAST(r.naid AS STRING) = @qNorm)",
  ];

  if (filters.confidence?.length && !filters.confidence.includes("high")) {
    where.push("FALSE");
  }
  if (filters.agencies?.length) {
    where.push("r.agency IN UNNEST(@agencies)");
    params.agencies = filters.agencies;
  }
  if (typeof filters.yearFrom === "number") {
    where.push("EXTRACT(YEAR FROM r.start_date) >= @yearFrom");
    params.yearFrom = filters.yearFrom;
  }
  if (typeof filters.yearTo === "number") {
    where.push("EXTRACT(YEAR FROM r.start_date) <= @yearTo");
    params.yearTo = filters.yearTo;
  }
  if (filters.entities?.length) {
    where.push(`r.document_id IN (
      SELECT document_id FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
      WHERE entity_id IN UNNEST(@entities)
    )`);
    params.entities = filters.entities;
  }
  if (filters.topics?.length) {
    const unionSql = topicDocumentUnionSql(filters.topics);
    where.push(unionSql ? `r.document_id IN (${unionSql})` : "FALSE");
  }

  const rows = await query<
    RecordRow & {
      match_confidence: ConfidenceLevel;
      total_count: number;
    }
  >(
    buildIdentifierSearchSql(
      WAREHOUSE_TABLES,
      where.join(" AND "),
      Number(limit),
      Number(offset),
    ),
    params,
  );
  const total = rows[0]?.total_count ?? 0;
  const results: SearchResult[] = rows.map((row) => ({
    kind: "document",
    document: rowToCard(row),
    mentionCount: 0,
    confidence: "high",
  }));

  return {
    query: qNorm,
    mode: "document",
    total,
    filters: identifierSearchFilters(rows, filters, total),
    results,
  };
}

function identifierSearchFilters(
  rows: RecordRow[],
  selected: SearchFilterInput,
  total: number,
): SearchFacetData {
  const agencyCounts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.agency) continue;
    agencyCounts[row.agency] = (agencyCounts[row.agency] ?? 0) + 1;
  }
  const agencies = Object.keys(agencyCounts);
  const topics = selected.topics ?? [];
  const entities = selected.entities ?? [];
  return {
    countScope: "query",
    years: denseSearchFacetYears(),
    yearCounts: {},
    yearBounds: SEARCH_FACET_YEAR_BOUNDS,
    agencies,
    agencyCounts,
    topics,
    topicLabels: Object.fromEntries(
      topics.map((slug) => [slug, TOPIC_CATALOG[slug]?.title ?? slug]),
    ),
    topicCounts: Object.fromEntries(topics.map((slug) => [slug, total])),
    entities,
    entityLabels: Object.fromEntries(entities.map((id) => [id, id])),
    entityCounts: Object.fromEntries(entities.map((id) => [id, total])),
    confidence: total > 0 ? ["high"] : [],
    confidenceCounts: total > 0 ? { high: total } : {},
  };
}

type SemanticHitRow = {
  chunk_id: string;
  chunk_order: number;
  document_id: string;
  naid: string;
  page_label: string | null;
  distance: number;
  title: string;
  agency: string | null;
  description: string | null;
  document_type: string | null;
  chunk_text: string;
};

async function fetchSemanticSearch({
  query: q,
  filters,
  limit,
}: {
  query: string;
  filters: SearchFilterInput;
  limit: number;
}): Promise<SearchResponse> {
  const qNorm = q.trim();
  if (!qNorm) {
    return {
      query: "",
      mode: "semantic",
      total: 0,
      filters: emptySearchFilters(),
      results: [],
    };
  }

  const facets = await loadSearchFacets(qNorm, filters);
  const hasMetadataFilters =
    !!filters.agencies?.length ||
    !!filters.entities?.length ||
    !!filters.topics?.length ||
    typeof filters.yearFrom === "number" ||
    typeof filters.yearTo === "number";
  const candidateLimit = semanticCandidateLimit(limit, hasMetadataFilters);
  const params: Record<string, unknown> = { q: qNorm, limit, candidateLimit };
  const where: string[] = [];
  if (filters.agencies?.length) {
    where.push("r.agency IN UNNEST(@agencies)");
    params.agencies = filters.agencies;
  }
  if (typeof filters.yearFrom === "number") {
    where.push("EXTRACT(YEAR FROM r.start_date) >= @yearFrom");
    params.yearFrom = filters.yearFrom;
  }
  if (typeof filters.yearTo === "number") {
    where.push("EXTRACT(YEAR FROM r.start_date) <= @yearTo");
    params.yearTo = filters.yearTo;
  }
  if (filters.entities?.length) {
    where.push(`r.document_id IN (
      SELECT document_id FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
      WHERE entity_id IN UNNEST(@entities)
    )`);
    params.entities = filters.entities;
  }
  if (filters.topics?.length) {
    const unionSql = topicDocumentUnionSql(filters.topics);
    where.push(unionSql ? `r.document_id IN (${unionSql})` : "FALSE");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query<SemanticHitRow>(
    `
    WITH query_emb AS (
      SELECT ml_generate_embedding_result AS embedding
      FROM ML.GENERATE_EMBEDDING(
        MODEL \`${PROJECT}.${DATASET_CURATED}.text_embedding\`,
        (SELECT @q AS content),
        STRUCT(TRUE AS flatten_json_output, 'RETRIEVAL_QUERY' AS task_type)
      )
    ),
    hits AS (
      SELECT
        base.chunk_id,
        base.document_id,
        base.naid,
        base.page_label,
        distance
      FROM VECTOR_SEARCH(
        TABLE \`${PROJECT}.${DATASET_CURATED}.chunk_embeddings\`,
        'embedding',
        (SELECT embedding FROM query_emb),
        top_k => @candidateLimit,
        distance_type => 'COSINE'
      )
    )
    SELECT
      h.chunk_id,
      c.chunk_order,
      h.document_id,
      h.naid,
      h.page_label,
      h.distance,
      r.title,
      r.agency,
      r.description,
      r.document_type,
      c.chunk_text
    FROM hits h
    JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r USING (document_id)
    JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_text_chunks\` c USING (chunk_id)
    ${whereSql}
    ORDER BY h.distance ASC
    LIMIT @limit
    `,
    params,
  );

  const results: SearchResult[] = rows.map((r) => ({
    kind: "mention",
    mention: {
      id: `sem-${r.chunk_id}`,
      documentId: r.document_id,
      documentTitle: recordDisplayTitle(r),
      documentHref: documentReaderHref(r.document_id, r.chunk_order),
      excerpt: truncateAround(r.chunk_text, [qNorm], 280),
      matchedTerms: [qNorm],
      confidence: "medium" as ConfidenceLevel,
      source: "semantic",
      pageLabel: r.page_label,
      chunkOrder: r.chunk_order,
      score: Math.max(0, Math.min(1, 1 - r.distance)),
    },
  }));

  return {
    query: qNorm,
    mode: "semantic",
    total: results.length,
    filters: facets,
    results,
  };
}

// ---------------------------------------------------------------------------
// ENTITY CO-OCCURRENCE — Phase 5-C. Reads sql/32 entity_cooccurrence and
// sums counts over the requested [yearFrom, yearTo] window. Pairs below
// minCount are dropped; isolated nodes (no remaining peers) are dropped too.
// ---------------------------------------------------------------------------

function hasWarehouseSearchFilters(filters: SearchFilterInput): boolean {
  return (
    !!filters.agencies?.length ||
    !!filters.topics?.length ||
    !!filters.entities?.length ||
    !!filters.confidence?.length ||
    typeof filters.yearFrom === "number" ||
    typeof filters.yearTo === "number"
  );
}

function topicDocumentUnionSql(slugs: readonly string[]): string {
  return slugs
    .filter(
      (slug) =>
        TOPIC_CATALOG[slug] && MVP_QUERYABLE_TOPIC_SLUGS.includes(slug),
    )
    .map(
      (slug) =>
        `SELECT document_id FROM \`${PROJECT}.${DATASET_MVP}.${TOPIC_CATALOG[slug]!.mvpTable}\``,
    )
    .join(" UNION ALL ");
}

function emptySearchFilters(): import("./api-types").SearchFilters {
  return {
    countScope: "corpus",
    years: [],
    yearCounts: {},
    yearBounds: { min: 1950, max: 2005 },
    agencies: [],
    agencyCounts: {},
    topics: [],
    topicLabels: {},
    topicCounts: {},
    entities: [],
    entityLabels: {},
    entityCounts: {},
    confidence: ["high", "medium", "low"],
    confidenceCounts: {},
  };
}

const COOC_YEAR_MIN = 1950;
const COOC_YEAR_MAX = 2005;

type CooccurrenceRow = {
  entity_a: string;
  entity_b: string;
  n: number;
};

type CooccurrenceDocumentRow = RecordRow & {
  entity_a: string;
  entity_b: string;
  rn: number;
};

export async function fetchEntityCooccurrence({
  yearFrom = COOC_YEAR_MIN,
  yearTo = COOC_YEAR_MAX,
  minCount = 2,
}: {
  yearFrom?: number;
  yearTo?: number;
  minCount?: number;
} = {}): Promise<CooccurrenceGraph> {
  if (useMockData()) {
    return buildEntityCooccurrence({ yearFrom, yearTo, minCount });
  }

  const lo = Math.max(COOC_YEAR_MIN, Math.min(yearFrom, yearTo));
  const hi = Math.min(COOC_YEAR_MAX, Math.max(yearFrom, yearTo));

  const [pairRows, documentRows, entities] = await Promise.all([
    query<CooccurrenceRow>(
      `SELECT entity_a, entity_b, SUM(cooccurrence_count) AS n
         FROM \`${PROJECT}.${DATASET_CURATED}.entity_cooccurrence\`
        WHERE year BETWEEN @lo AND @hi
        GROUP BY entity_a, entity_b
        HAVING n >= @minCount
        ORDER BY n DESC`,
      { lo, hi, minCount },
    ),
    query<CooccurrenceDocumentRow>(
      `WITH eligible_pairs AS (
         SELECT entity_a, entity_b, SUM(cooccurrence_count) AS n
           FROM \`${PROJECT}.${DATASET_CURATED}.entity_cooccurrence\`
          WHERE year BETWEEN @lo AND @hi
          GROUP BY entity_a, entity_b
         HAVING n >= @minCount
       ),
       pair_docs AS (
         SELECT
           ep.entity_a,
           ep.entity_b,
           r.document_id,
           CAST(r.naid AS STRING) AS naid,
           r.title,
           r.description,
           r.record_group,
           r.agency,
           r.collection_name,
           r.start_date,
           r.end_date,
           r.release_date,
           r.release_set,
           r.source_url,
           r.thumbnail_url,
           r.digital_object_url,
           r.document_type,
           r.has_ocr,
           r.has_digital_object,
           r.num_pages,
           r.pages_released,
           r.withholding_status,
           ROW_NUMBER() OVER (
             PARTITION BY ep.entity_a, ep.entity_b
             ORDER BY r.start_date DESC NULLS LAST, r.document_id
           ) AS rn
         FROM eligible_pairs ep
         JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\` a
           ON a.entity_id = ep.entity_a
          AND a.confidence IN ('high', 'medium')
         JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\` b
           ON b.document_id = a.document_id
          AND b.entity_id = ep.entity_b
          AND b.confidence IN ('high', 'medium')
         JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r
           ON r.document_id = a.document_id
        WHERE r.start_date IS NOT NULL
          AND EXTRACT(YEAR FROM r.start_date) BETWEEN @lo AND @hi
       )
       SELECT *
         FROM pair_docs
        WHERE rn <= 4
        ORDER BY entity_a, entity_b, rn`,
      { lo, hi, minCount },
    ),
    loadEntities(),
  ]);

  const documentsByPair = new Map<string, DocumentCard[]>();
  for (const row of documentRows) {
    const key = cooccurrencePairKey(row.entity_a, row.entity_b);
    const list = documentsByPair.get(key) ?? [];
    list.push(rowToCard(row));
    documentsByPair.set(key, list);
  }

  const connectedIds = new Set<string>();
  const degreeById = new Map<string, number>();
  const links: CooccurrenceLink[] = pairRows.map((r) => {
    connectedIds.add(r.entity_a);
    connectedIds.add(r.entity_b);
    degreeById.set(r.entity_a, (degreeById.get(r.entity_a) ?? 0) + 1);
    degreeById.set(r.entity_b, (degreeById.get(r.entity_b) ?? 0) + 1);
    return {
      source: r.entity_a,
      target: r.entity_b,
      count: r.n,
      documents: documentsByPair.get(cooccurrencePairKey(r.entity_a, r.entity_b)) ?? [],
    };
  });

  const nodes: CooccurrenceNode[] = entities
    .filter((e) => connectedIds.has(e.entity_id))
    .map((e) => ({
      id: e.entity_id,
      name: e.entity_name,
      type: e.entity_type,
      degree: degreeById.get(e.entity_id) ?? 0,
    }))
    .sort((a, b) => b.degree - a.degree);

  return addMediaAssetsToCooccurrenceGraph(
    {
      nodes,
      links,
      yearBounds: { min: COOC_YEAR_MIN, max: COOC_YEAR_MAX },
      appliedRange: { yearFrom: lo, yearTo: hi },
    },
    {
      entityNodes: entities.map((entity) => ({
        id: entity.entity_id,
        name: entity.entity_name,
        type: entity.entity_type,
      })),
      topicLabels: Object.fromEntries(
        Object.entries(TOPIC_CATALOG).map(([slug, topic]) => [slug, topic.title]),
      ),
    },
  );
}

function cooccurrencePairKey(source: string, target: string): string {
  return `${source}--${target}`;
}

let corpusSearchFacetsPromise: Promise<SearchFacetData> | null = null;
let entityMembershipPromise: Promise<Map<string, string[]>> | null = null;
let topicMembershipPromise: Promise<Map<string, string[]>> | null = null;

type MentionRow = {
  document_id: string;
  naid: string;
  title: string;
  agency: string | null;
  description: string | null;
  document_type: string | null;
  chunk_id: string;
  chunk_order: number;
  chunk_text: string;
  page_label: string | null;
  total_count: number;
};

async function fetchMentionRows({
  whereSql,
  documentIds,
  params,
  limit,
  offset,
}: {
  whereSql: string;
  documentIds: readonly string[];
  params: Record<string, unknown>;
  limit: number;
  offset: number;
}): Promise<MentionRow[]> {
  if (documentIds.length === 0) return [];
  try {
    return await query<MentionRow>(
      buildMentionSearchSql(
        WAREHOUSE_TABLES,
        whereSql,
        documentIds,
        Number(limit),
        Number(offset),
      ),
      params,
    );
  } catch (error) {
    if (isBigQueryNotFound(error) || isBigQueryBytesBilledExceeded(error)) {
      console.warn("[warehouse] mention OCR scan skipped");
      return [];
    }
    throw error;
  }
}

async function fetchMentionTotal(
  whereSql: string,
  documentIds: readonly string[],
  params: Record<string, unknown>,
): Promise<number> {
  if (documentIds.length === 0) return 0;
  try {
    const rows = await query<{ n: number }>(
      buildMentionSearchCountSql(WAREHOUSE_TABLES, whereSql, documentIds),
      params,
    );
    return rows[0]?.n ?? 0;
  } catch (error) {
    if (isBigQueryNotFound(error) || isBigQueryBytesBilledExceeded(error)) {
      return 0;
    }
    throw error;
  }
}

async function fetchOcrSnippets(
  documentIds: string[],
  qLike: string,
): Promise<Map<string, string>> {
  if (documentIds.length === 0 || qLike === "%") return new Map();
  try {
    const rows = await query<{ document_id: string; hit_text: string | null }>(
      buildOcrSnippetSql(WAREHOUSE_TABLES, documentIds),
    );
    return new Map(
      rows
        .filter((row) => row.hit_text)
        .map((row) => [row.document_id, row.hit_text as string]),
    );
  } catch (error) {
    if (isBigQueryBytesBilledExceeded(error) || isBigQueryNotFound(error)) {
      console.warn("[warehouse] OCR snippet scan skipped");
      return new Map();
    }
    throw error;
  }
}

async function fetchOcrHitDocumentIds(qNorm: string): Promise<string[]> {
  const tokens = extractSearchTokens(qNorm);
  if (tokens.length === 0) return [];
  try {
    const rows = await query<{ document_id: string }>(
      buildOcrHitDocumentIdSql(WAREHOUSE_TABLES, tokens.length),
      ocrTokenRangeParams(tokens),
    );
    return rows.map((row) => row.document_id);
  } catch (error) {
    if (isBigQueryBytesBilledExceeded(error) || isBigQueryNotFound(error)) {
      console.warn(
        "[warehouse] OCR token lookup skipped:",
        isBigQueryNotFound(error)
          ? "search_ocr_document_tokens missing (run sql/33)"
          : "bytes billed cap",
      );
      return [];
    }
    throw error;
  }
}

type DocumentOcrPageMeta = OcrPageMetaRecord;

type DocumentOcrPageRow = {
  chunk_id: string;
  chunk_order: number;
  chunk_text: string;
  page_label: string | null;
  source_type: string;
  prev_chunk_order: number | null;
  next_chunk_order: number | null;
};

type DocumentOcrFirstPage =
  | {
      kind: "page";
      meta: DocumentOcrPageMeta;
      page: DocumentOcrPageRow;
      lastPageLabel: string | null;
    }
  | { kind: "unavailable" }
  | { kind: "none" };

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  if (value && typeof value === "object" && "value" in value) {
    return asInt((value as { value: unknown }).value);
  }
  return null;
}

function normalizePageMeta(
  row: Record<string, unknown> | DocumentOcrPageMeta,
): DocumentOcrPageMeta | null {
  const documentId = String(row.document_id ?? "");
  const chunkCount = asInt(row.chunk_count);
  const first = asInt(row.first_chunk_order);
  const last = asInt(row.last_chunk_order);
  const shard = asInt(row.doc_shard);
  if (!documentId || chunkCount == null || first == null || last == null || shard == null) {
    return null;
  }
  return {
    document_id: documentId,
    chunk_count: chunkCount,
    first_chunk_order: first,
    last_chunk_order: last,
    doc_shard: shard,
  };
}

function normalizePageRow(
  row: Record<string, unknown> | DocumentOcrPageRow,
): DocumentOcrPageRow | null {
  const chunkOrder = asInt(row.chunk_order);
  const text = typeof row.chunk_text === "string" ? row.chunk_text : null;
  if (chunkOrder == null || text == null) return null;
  return {
    chunk_id: String(row.chunk_id ?? `${chunkOrder}`),
    chunk_order: chunkOrder,
    chunk_text: text,
    page_label: typeof row.page_label === "string" ? row.page_label : null,
    source_type: typeof row.source_type === "string" ? row.source_type : "abbyy_ocr",
    prev_chunk_order: asInt(row.prev_chunk_order),
    next_chunk_order: asInt(row.next_chunk_order),
  };
}

async function fetchDocumentOcrPageMeta(
  documentId: string,
): Promise<{ kind: "meta"; meta: DocumentOcrPageMeta } | { kind: "none" } | { kind: "unavailable" }> {
  if (isOcrPageMetaTableUnavailable()) return { kind: "unavailable" };
  const cached = ocrPageMetaCache.get(documentId);
  if (cached) return { kind: "meta", meta: cached };
  try {
    const rows = await query<Record<string, unknown>>(
      buildDocumentPageMetaSql(WAREHOUSE_TABLES),
      { id: documentId },
    );
    const meta = rows[0] ? normalizePageMeta(rows[0]) : null;
    if (!meta) return { kind: "none" };
    ocrPageMetaCache.setPositive(documentId, meta);
    return { kind: "meta", meta };
  } catch (error) {
    if (isBigQueryNotFound(error) || isBigQueryBytesBilledExceeded(error)) {
      console.warn(
        "[warehouse] search_ocr_page_meta unavailable; document OCR will not scan fat chunk tables",
      );
      markOcrPageMetaTableUnavailable();
      return { kind: "unavailable" };
    }
    throw error;
  }
}

async function fetchDocumentOcrPageRow(
  documentId: string,
  shard: number,
  chunkOrder: number,
): Promise<DocumentOcrPageRow | "unavailable" | null> {
  const pages = await fetchDocumentOcrPageRows(documentId, shard, [chunkOrder]);
  if (pages === "unavailable") return "unavailable";
  return pages.get(chunkOrder) ?? null;
}

async function fetchDocumentOcrPageRows(
  documentId: string,
  shard: number,
  chunkOrders: number[],
): Promise<Map<number, DocumentOcrPageRow> | "unavailable"> {
  const unique = [
    ...new Set(
      chunkOrders.filter((order) => Number.isFinite(order)).map((order) =>
        Math.trunc(order),
      ),
    ),
  ];
  if (unique.length === 0) return new Map();
  try {
    const rows = await query<Record<string, unknown>>(
      unique.length === 1
        ? buildDocumentOnePageSql(WAREHOUSE_TABLES)
        : buildDocumentPagesSql(WAREHOUSE_TABLES),
      unique.length === 1
        ? { id: documentId, shard, chunkOrder: unique[0] }
        : { id: documentId, shard, chunkOrders: unique },
    );
    const pages = new Map<number, DocumentOcrPageRow>();
    for (const row of rows) {
      const page = normalizePageRow(row);
      if (page) pages.set(page.chunk_order, page);
    }
    return pages;
  } catch (error) {
    if (isBigQueryNotFound(error) || isBigQueryBytesBilledExceeded(error)) {
      console.warn(
        "[warehouse] search_ocr_pages unavailable; document OCR will not scan fat chunk tables",
      );
      return "unavailable";
    }
    throw error;
  }
}

async function fetchDocumentOcrFirstPage(
  documentId: string,
  chunkOrder?: number | null,
): Promise<DocumentOcrFirstPage> {
  const metaResult = await fetchDocumentOcrPageMeta(documentId);
  if (metaResult.kind !== "meta") return metaResult;
  return fetchDocumentOcrFirstPageFromMeta(documentId, metaResult.meta, chunkOrder);
}

async function fetchDocumentOcrFirstPageFromMeta(
  documentId: string,
  meta: OcrPageMetaRecord | null,
  chunkOrder?: number | null,
): Promise<DocumentOcrFirstPage> {
  if (!meta) return { kind: "none" };
  ocrPageMetaCache.setPositive(documentId, meta);
  const requested =
    chunkOrder == null || !Number.isFinite(chunkOrder)
      ? meta.first_chunk_order
      : Math.trunc(chunkOrder);
  const chunkOrders = [requested];
  if (requested !== meta.last_chunk_order) {
    chunkOrders.push(meta.last_chunk_order);
  }
  const pages = await fetchDocumentOcrPageRows(
    documentId,
    meta.doc_shard,
    chunkOrders,
  );
  if (pages === "unavailable") return { kind: "unavailable" };
  let page = pages.get(requested) ?? null;
  if (!page && requested !== meta.first_chunk_order) {
    const firstPages = await fetchDocumentOcrPageRows(
      documentId,
      meta.doc_shard,
      [meta.first_chunk_order],
    );
    if (firstPages === "unavailable") return { kind: "unavailable" };
    page = firstPages.get(meta.first_chunk_order) ?? null;
  }
  if (!page) return { kind: "unavailable" };
  const lastLabelSource =
    pages.get(meta.last_chunk_order) ??
    (requested === meta.last_chunk_order ? page : null);
  return {
    kind: "page",
    meta,
    page,
    lastPageLabel: lastLabelSource?.page_label ?? null,
  };
}

function mockDocumentOcrPage(id: string, chunkOrder?: number | null): DocumentOcrPageResponse | null {
  const mock = buildDocumentResponse(id);
  if (!mock) return null;
  const text = mock.document.ocrExcerpt;
  if (!text) {
    return mock.document.hasOcr
      ? {
          documentId: mock.document.id,
          page: null,
          prevChunkOrder: null,
          nextChunkOrder: null,
          chunkCount: 0,
          firstChunkOrder: null,
          lastChunkOrder: null,
          ocrBodyUnavailable: true,
        }
      : null;
  }
  const order = chunkOrder ?? 1;
  return {
    documentId: mock.document.id,
    page: {
      pageLabel: "p. 1",
      text,
      chunkOrder: order,
    },
    prevChunkOrder: null,
    nextChunkOrder: null,
    chunkCount: 1,
    firstChunkOrder: order,
    lastChunkOrder: order,
  };
}

/**
 * One OCR page for the document reader. Never reads the unpartitioned
 * OCR body tables. Missing sql/35 degrades honestly.
 */
export async function fetchDocumentOcrPage(
  id: string,
  chunkOrder?: number | null,
): Promise<DocumentOcrPageResponse | null> {
  if (useMockData()) return mockDocumentOcrPage(id, chunkOrder);

  const metaResult = await fetchDocumentOcrPageMeta(id);
  if (metaResult.kind === "unavailable") {
    return {
      documentId: id,
      page: null,
      prevChunkOrder: null,
      nextChunkOrder: null,
      chunkCount: 0,
      firstChunkOrder: null,
      lastChunkOrder: null,
      ocrBodyUnavailable: true,
    };
  }
  if (metaResult.kind === "none") return null;

  const meta = metaResult.meta;
  const requested =
    chunkOrder == null || !Number.isFinite(chunkOrder)
      ? meta.first_chunk_order
      : Math.trunc(chunkOrder);
  const page = await fetchDocumentOcrPageRow(id, meta.doc_shard, requested);
  if (page === "unavailable") {
    return {
      documentId: meta.document_id,
      page: null,
      prevChunkOrder: null,
      nextChunkOrder: null,
      chunkCount: meta.chunk_count,
      firstChunkOrder: meta.first_chunk_order,
      lastChunkOrder: meta.last_chunk_order,
      ocrBodyUnavailable: true,
    };
  }
  if (!page) return null;

  return {
    documentId: meta.document_id,
    page: {
      pageLabel: page.page_label || `chunk ${page.chunk_order}`,
      text: page.chunk_text,
      chunkOrder: page.chunk_order,
    },
    prevChunkOrder: page.prev_chunk_order,
    nextChunkOrder: page.next_chunk_order,
    chunkCount: meta.chunk_count,
    firstChunkOrder: meta.first_chunk_order,
    lastChunkOrder: meta.last_chunk_order,
  };
}

async function loadEntityMembership(): Promise<Map<string, string[]>> {
  if (!entityMembershipPromise) {
    entityMembershipPromise = query<{ document_id: string; entity_id: string }>(
      buildEntityMembershipSql(WAREHOUSE_TABLES),
    )
      .then((rows) => {
        const membership = new Map<string, string[]>();
        for (const row of rows) {
          const list = membership.get(row.document_id) ?? [];
          list.push(row.entity_id);
          membership.set(row.document_id, list);
        }
        return membership;
      })
      .catch((error) => {
        // Reset so a later request retries instead of serving empty facets
        // for the life of this Cloud Run instance.
        entityMembershipPromise = null;
        if (isBigQueryBytesBilledExceeded(error)) {
          console.warn("[warehouse] entity membership scan skipped: bytes billed cap");
          return new Map<string, string[]>();
        }
        throw error;
      });
  }
  return entityMembershipPromise;
}

async function loadTopicMembership(): Promise<Map<string, string[]>> {
  if (!topicMembershipPromise) {
    topicMembershipPromise = query<{ document_id: string; topic_slug: string }>(
      buildTopicMembershipSql(WAREHOUSE_TABLES, queryableTopicTables()),
    )
      .then((rows) => {
        const membership = new Map<string, string[]>();
        for (const row of rows) {
          const list = membership.get(row.document_id) ?? [];
          list.push(row.topic_slug);
          membership.set(row.document_id, list);
        }
        return membership;
      })
      .catch((error) => {
        // Reset so a later request retries instead of serving empty facets
        // for the life of this Cloud Run instance.
        topicMembershipPromise = null;
        if (isBigQueryBytesBilledExceeded(error)) {
          console.warn("[warehouse] topic membership scan skipped: bytes billed cap");
          return new Map<string, string[]>();
        }
        throw error;
      });
  }
  return topicMembershipPromise;
}

async function loadSearchFacets(
  qNorm: string,
  filters: SearchFilterInput,
  ocrHitIds?: string[],
): Promise<SearchFacetData> {
  if (searchFacetCountScope(qNorm, filters) !== "corpus") {
    return querySearchFacets(qNorm, filters, ocrHitIds);
  }

  // The empty search page is common and its corpus distribution is stable for
  // the lifetime of a Cloud Run instance. Avoid paying for the same aggregate
  // on every visit; reset after a failure so a transient BQ error can recover.
  if (!corpusSearchFacetsPromise) {
    corpusSearchFacetsPromise = queryCorpusSearchFacets().catch((error) => {
      corpusSearchFacetsPromise = null;
      throw error;
    });
  }
  return corpusSearchFacetsPromise;
}

async function queryCorpusSearchFacets(): Promise<SearchFacetData> {
  const [years, agencies, entityMeta, entityCountRows, topicCountRows] =
    await Promise.all([
      query<{ y: string; n: number }>(buildCorpusYearFacetSql(WAREHOUSE_TABLES)),
      query<{ agency: string; n: number }>(
        buildCorpusAgencyFacetSql(WAREHOUSE_TABLES),
      ),
      loadEntities(),
      query<{ entity_id: string; n: number }>(
        buildCorpusEntityFacetSql(WAREHOUSE_TABLES),
      ),
      query<{ slug: string; n: number }>(
        buildCorpusTopicFacetSql(WAREHOUSE_TABLES, queryableTopicTables()),
      ),
    ]);

  const yearCounts: Record<string, number> = {};
  for (const row of years) yearCounts[row.y] = Number(row.n);
  const agencyCounts = Object.fromEntries(
    agencies.map((row) => [row.agency, Number(row.n)]),
  );
  const entityCounts = Object.fromEntries(
    entityCountRows.map((row) => [row.entity_id, Number(row.n)]),
  );
  const topicCounts = Object.fromEntries(
    topicCountRows.map((row) => [row.slug, Number(row.n)]),
  );

  return {
    countScope: "corpus",
    years: denseSearchFacetYears(),
    yearCounts,
    yearBounds: SEARCH_FACET_YEAR_BOUNDS,
    agencies: rankedFacetValues(agencyCounts),
    agencyCounts,
    topics: rankedFacetValues(topicCounts),
    topicLabels: Object.fromEntries(
      MVP_QUERYABLE_TOPIC_SLUGS.map((slug) => [slug, TOPIC_CATALOG[slug]!.title]),
    ),
    topicCounts,
    entities: rankedFacetValues(entityCounts),
    entityLabels: Object.fromEntries(
      entityMeta.map((entity) => [entity.entity_id, entity.entity_name]),
    ),
    entityCounts,
    confidence: [],
    confidenceCounts: {},
  };
}

async function querySearchFacets(
  qNorm: string,
  filters: SearchFilterInput,
  ocrHitIds?: string[],
): Promise<SearchFacetData> {
  const qLike = qNorm ? `%${qNorm.toLowerCase()}%` : "%";
  const resolvedOcrHitIds =
    ocrHitIds ?? (qNorm ? await fetchOcrHitDocumentIds(qNorm) : []);

  const [matchedRows, entityMeta, entityMembership, topicMembership] =
    await Promise.all([
      query<{
        document_id: string;
        agency: string | null;
        start_date: { value: string } | string | null;
        match_confidence: ConfidenceLevel | null;
      }>(
        qNorm
          ? buildQueryMatchedDocumentsSql(WAREHOUSE_TABLES)
          : buildFilterOnlyDocumentsSql(WAREHOUSE_TABLES),
        qNorm
          ? {
              qNorm,
              qLike,
              ocrHitIds: resolvedOcrHitIds,
            }
          : {},
      ),
      loadEntities(),
      loadEntityMembership(),
      loadTopicMembership(),
    ]);

  const documents: SearchFacetDocument[] = matchedRows.map((row) => {
    const start = readDate(row.start_date);
    const year = start ? Number(start.slice(0, 4)) : null;
    return {
      documentId: row.document_id,
      agency: row.agency,
      year: Number.isFinite(year) ? year : null,
      matchConfidence: row.match_confidence,
      entityIds: entityMembership.get(row.document_id) ?? [],
      topicSlugs: topicMembership.get(row.document_id) ?? [],
    };
  });

  return aggregateQuerySearchFacets({
    query: qNorm,
    filters,
    documents,
    entityLabels: Object.fromEntries(
      entityMeta.map((entity) => [entity.entity_id, entity.entity_name]),
    ),
    topicLabels: Object.fromEntries(
      MVP_QUERYABLE_TOPIC_SLUGS.map((slug) => [slug, TOPIC_CATALOG[slug]!.title]),
    ),
  });
}

// ---------------------------------------------------------------------------
// OPEN QUESTIONS — backed by sql/27-29 (map-reduce over every record)
// ---------------------------------------------------------------------------

function firstParagraph(text: string, maxLen = 320): string {
  const para = text.split(/\n{2,}/)[0]?.trim() ?? "";
  if (para.length <= maxLen) return para;
  // clip on sentence boundary if possible
  const clipped = para.slice(0, maxLen);
  const lastDot = clipped.lastIndexOf(". ");
  return lastDot > 120 ? clipped.slice(0, lastDot + 1) : clipped + "…";
}

function readTimestamp(
  v: { value: string } | string | null | undefined,
): string {
  if (!v) return "";
  return typeof v === "string" ? v : v.value;
}

type OpenQuestionsTopicRow = {
  slug: string;
  topic_title: string;
  article: string | null;
  source_doc_count: number | null;
  input_question_count: number | null;
  model: string | null;
  generated_at: { value: string } | string | null;
  tension_counts:
    | Array<{ tension_type: string | null; n: number }>
    | null;
  question_count: number | null;
};

async function loadOpenQuestionsTopicRows(): Promise<OpenQuestionsTopicRow[]> {
  // LEFT JOIN the reduce-stage article onto the map-stage question
  // counts so we still get a row if the article failed but questions
  // exist, and so per-topic tension histograms are available cheaply.
  return query<OpenQuestionsTopicRow>(
    `WITH tension_by_topic AS (
       SELECT slug,
              tension_type,
              COUNT(*) AS n
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_topic_batch_questions\`
        GROUP BY slug, tension_type
     ),
     grouped AS (
       SELECT slug,
              ARRAY_AGG(STRUCT(tension_type, n)) AS tension_counts,
              SUM(n) AS question_count
         FROM tension_by_topic
        GROUP BY slug
     )
     SELECT q.slug,
            q.topic_title,
            q.article,
            q.source_doc_count,
            q.input_question_count,
            q.model,
            q.generated_at,
            g.tension_counts,
            g.question_count
       FROM \`${PROJECT}.${DATASET_CURATED}.jfk_topic_open_questions\` q
       LEFT JOIN grouped g USING (slug)`,
  );
}

function rowToOpenQuestionsTopicCard(
  r: OpenQuestionsTopicRow,
): OpenQuestionsTopicCard {
  const catalog = TOPIC_CATALOG[r.slug];
  const tensionCounts: Record<string, number> = {};
  for (const t of r.tension_counts ?? []) {
    const key = t.tension_type ?? "other";
    tensionCounts[key] = (tensionCounts[key] ?? 0) + t.n;
  }
  return {
    slug: r.slug,
    title: catalog?.title ?? r.topic_title,
    eyebrow: catalog?.eyebrow,
    summary: r.article ? firstParagraph(r.article) : (catalog?.summary ?? ""),
    href: `/open-questions/${r.slug}`,
    questionCount: r.question_count ?? r.input_question_count ?? 0,
    sourceDocCount: r.source_doc_count ?? 0,
    tensionCounts,
  };
}

export async function fetchOpenQuestionsIndex(): Promise<OpenQuestionsIndexResponse> {
  if (useMockData()) return buildOpenQuestionsIndex();

  const [globalRows, topicRows] = await Promise.all([
    query<{
      article: string | null;
      source_doc_count: number | null;
      model: string | null;
      generated_at: { value: string } | string | null;
    }>(
      `SELECT article, source_doc_count, model, generated_at
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_global_open_questions\`
        WHERE slug = 'global'
        LIMIT 1`,
    ).catch(() => []),
    loadOpenQuestionsTopicRows().catch(() => []),
  ]);

  const g = globalRows[0];
  const global: OpenQuestionsArticle | null =
    g && g.article
      ? {
          text: g.article,
          model: g.model ?? "gemini-2.5-pro",
          generatedAt: readTimestamp(g.generated_at),
          sourceDocCount: g.source_doc_count ?? 0,
        }
      : null;

  const topicCards = topicRows
    .map((r) => rowToOpenQuestionsTopicCard(r))
    // Preserve the canonical topic display order
    .sort(
      (a, b) =>
        TOPIC_DISPLAY_ORDER.indexOf(a.slug) -
        TOPIC_DISPLAY_ORDER.indexOf(b.slug),
    );

  return { global, topics: topicCards };
}

export async function fetchOpenQuestionsTopic(
  slug: string,
): Promise<OpenQuestionsTopicResponse | null> {
  if (useMockData()) return buildOpenQuestionsTopic(slug);

  const catalog = TOPIC_CATALOG[slug];
  if (!catalog) return null;

  const [articleRows, threadRows, footnoteRows, cryptonymRows] = await Promise.all([
    query<{
      topic_title: string;
      article: string | null;
      source_doc_count: number | null;
      input_question_count: number | null;
      model: string | null;
      generated_at: { value: string } | string | null;
    }>(
      `SELECT topic_title, article, source_doc_count, input_question_count,
              model, generated_at
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_topic_open_questions\`
        WHERE slug = @slug
        LIMIT 1`,
      { slug },
    ).catch(() => []),
    query<{
      batch_num: number;
      question_index: number;
      question: string;
      summary: string | null;
      tension_type: string | null;
      supporting_doc_ids: string[] | null;
      status: string | null;
      resolution_text: string | null;
      resolution_citation_ids: string[] | null;
    }>(
      `SELECT batch_num, question_index, question, summary, tension_type,
              supporting_doc_ids, status, resolution_text,
              resolution_citation_ids
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_topic_batch_questions\`
        WHERE slug = @slug
        ORDER BY
          CASE COALESCE(status, 'open')
            WHEN 'open' THEN 0
            WHEN 'partially_resolved' THEN 1
            WHEN 'resolved' THEN 2
            ELSE 3
          END,
          CASE tension_type
            WHEN 'contradiction' THEN 0
            WHEN 'timing' THEN 1
            WHEN 'unexplained_reference' THEN 2
            WHEN 'redaction' THEN 3
            WHEN 'gap' THEN 4
            WHEN 'pattern' THEN 5
            ELSE 6
          END,
          batch_num, question_index
        LIMIT 200`,
      { slug },
    ).catch(() => []),
    query<{
      footnote_id: string;
      tag: string;
      title: string;
      body: string;
      source_citation: string;
      trigger_patterns: string[] | null;
    }>(
      `SELECT footnote_id, tag, title, body, source_citation, trigger_patterns
         FROM \`${PROJECT}.${DATASET_CURATED}.editorial_footnotes\`
        WHERE @slug IN UNNEST(applies_to_slugs)
        ORDER BY sort_order`,
      { slug },
    ).catch(() => []),
    query<{
      cryptonym: string;
      meaning: string;
      status: string;
      first_public_source: string | null;
      source_citation_id: string | null;
      related_entity_ids: string[] | null;
      notes: string | null;
    }>(
      `SELECT cryptonym, meaning, status, first_public_source,
              source_citation_id, related_entity_ids, notes
         FROM \`${PROJECT}.${DATASET_CURATED}.cryptonym_glossary\`
        ORDER BY cryptonym`,
    ).catch(() => []),
  ]);

  const row = articleRows[0];
  const article: OpenQuestionsArticle | null =
    row && row.article
      ? {
          text: row.article,
          model: row.model ?? "gemini-2.5-pro",
          generatedAt: readTimestamp(row.generated_at),
          sourceDocCount: row.source_doc_count ?? 0,
        }
      : null;

  const threads: OpenQuestionThread[] = threadRows.map((t) => {
    const rawStatus = t.status ?? "open";
    const status =
      rawStatus === "resolved" || rawStatus === "partially_resolved"
        ? rawStatus
        : "open";
    return {
      id: `q-${t.batch_num}-${t.question_index}`,
      question: t.question,
      summary: t.summary,
      tensionType: t.tension_type,
      supportingDocIds: t.supporting_doc_ids ?? [],
      status,
      resolutionText: t.resolution_text,
      resolutionCitationIds: t.resolution_citation_ids ?? [],
    };
  });

  // Match editorial footnotes to this topic's surface. A footnote with no
  // trigger_patterns attaches unconditionally; otherwise any pattern must
  // occur in the article text or any thread's question/summary.
  const corpus = [
    article?.text ?? "",
    ...threads.flatMap((t) => [t.question, t.summary ?? ""]),
  ]
    .join(" \n ")
    .toLowerCase();
  const editorialFootnotes: EditorialFootnote[] = footnoteRows
    .filter((f) => {
      const patterns = f.trigger_patterns ?? [];
      if (patterns.length === 0) return true;
      return patterns.some((p) => corpus.includes(p.toLowerCase()));
    })
    .map((f) => ({
      id: f.footnote_id,
      tag: f.tag,
      title: f.title,
      body: f.body,
      sourceCitation: f.source_citation,
    }));

  // If neither an article nor any threads exist, treat as not-found so
  // the page can 404 cleanly rather than render an empty shell.
  if (!article && threads.length === 0) return null;

  const cryptonyms: CryptonymEntry[] = cryptonymRows.map((c) => ({
    cryptonym: c.cryptonym,
    meaning: c.meaning,
    status:
      c.status === "declassified" || c.status === "partial"
        ? c.status
        : "unresolved",
    firstPublicSource: c.first_public_source ?? null,
    sourceCitationId: c.source_citation_id || null,
    relatedEntityIds: c.related_entity_ids ?? [],
    notes: c.notes || null,
  }));

  return {
    slug,
    title: catalog.title,
    eyebrow: catalog.eyebrow,
    topicHref: `/topic/${slug}`,
    article,
    questionCount: threads.length,
    threads,
    editorialFootnotes,
    cryptonyms,
  };
}

// ---------------------------------------------------------------------------
// CASE-WIDE TIMELINE
// ---------------------------------------------------------------------------

type CaseTimelineRow = {
  event_id: string;
  event_date: { value: string } | string;
  event_time_local: string | null;
  title: string;
  description: string;
  category: string;
  related_entity_ids: string[] | null;
  related_topic_ids: string[] | null;
  source_external: string[] | null;
  importance: number | null;
};

export async function fetchCaseTimeline(): Promise<CaseTimelineIndex> {
  if (useMockData()) return buildCaseTimelineIndex();

  const [rows, docLinkRows] = await Promise.all([
    query<CaseTimelineRow>(
      `SELECT event_id, event_date, event_time_local, title, description,
              category, related_entity_ids, related_topic_ids,
              source_external, importance
         FROM \`${PROJECT}.${DATASET_CURATED}.timeline_events\`
        ORDER BY event_date, event_time_local NULLS FIRST`,
    ),
    query<{
      event_id: string;
      document_id: string;
      note: string | null;
      title: string | null;
      naid: string | null;
      agency: string | null;
      description: string | null;
      document_type: string | null;
    }>(
      `SELECT d.event_id, d.document_id, d.note, r.title,
              r.naid, r.agency, r.description, r.document_type
         FROM \`${PROJECT}.${DATASET_CURATED}.timeline_event_documents\` d
         LEFT JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r
           USING (document_id)
        ORDER BY d.event_id, d.sort_order`,
    ),
  ]);

  const docLinksByEvent = new Map<string, CaseTimelineEvent["documentLinks"]>();
  for (const r of docLinkRows) {
    const list = docLinksByEvent.get(r.event_id) ?? [];
    list.push({
      documentId: r.document_id,
      title: r.title ? recordDisplayTitle(r) : r.title,
      note: r.note,
    });
    docLinksByEvent.set(r.event_id, list);
  }

  const events: CaseTimelineEvent[] = rows.map((r) => {
    const dateStr =
      typeof r.event_date === "object" ? r.event_date.value : r.event_date;
    return {
      id: r.event_id,
      date: dateStr,
      timeLocal: r.event_time_local,
      title: r.title,
      description: r.description,
      category: r.category as CaseTimelineCategory,
      relatedEntityIds: r.related_entity_ids ?? [],
      relatedTopicIds: r.related_topic_ids ?? [],
      sourceExternal: r.source_external ?? [],
      documentLinks: docLinksByEvent.get(r.event_id) ?? [],
      importance: r.importance ?? 3,
    };
  });

  const categoryCounts = new Map<CaseTimelineCategory, number>();
  for (const e of events) {
    categoryCounts.set(e.category, (categoryCounts.get(e.category) ?? 0) + 1);
  }
  const CATEGORY_ORDER: CaseTimelineCategory[] = [
    "biographical",
    "operational",
    "investigation",
    "release",
    "death",
  ];
  const countsByCategory = CATEGORY_ORDER.filter((c) =>
    categoryCounts.has(c),
  ).map((c) => ({ category: c, count: categoryCounts.get(c) ?? 0 }));

  const decadeCounts = new Map<string, number>();
  for (const e of events) {
    const year = parseInt(e.date.slice(0, 4), 10);
    if (!Number.isNaN(year)) {
      const decade = `${Math.floor(year / 10) * 10}s`;
      decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
    }
  }
  const countsByDecade = Array.from(decadeCounts.entries())
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade.localeCompare(b.decade));

  return { events, countsByCategory, countsByDecade };
}

// ---------------------------------------------------------------------------
// BIBLIOGRAPHY (citation registry)
// ---------------------------------------------------------------------------

type CitationRow = {
  citation_id: string;
  citation_type: string;
  bluebook: string;
  chicago: string;
  apa: string;
  url: string | null;
  author: string | null;
  title: string;
  publisher: string | null;
  year: number | null;
  allowlisted: boolean;
};

export async function fetchBibliographyIndex(): Promise<BibliographyIndex> {
  if (useMockData()) return buildBibliographyIndex();

  const rows = await query<CitationRow>(
    `SELECT *
       FROM \`${PROJECT}.${DATASET_CURATED}.citation_registry\`
      WHERE allowlisted = true
      ORDER BY sort_order`,
  );

  const citations: CitationEntry[] = rows.map((r) => ({
    id: r.citation_id,
    type: r.citation_type as CitationType,
    bluebook: r.bluebook,
    chicago: r.chicago,
    apa: r.apa,
    url: r.url,
    author: r.author,
    title: r.title,
    publisher: r.publisher,
    year: r.year,
  }));

  const typeCounts = new Map<CitationType, number>();
  for (const c of citations) {
    typeCounts.set(c.type, (typeCounts.get(c.type) ?? 0) + 1);
  }
  const TYPE_ORDER: CitationType[] = [
    "WC",
    "HSCA",
    "ARRB",
    "CHURCH",
    "REPORT",
    "NARA",
    "BOOK",
    "JOURNAL",
    "NEWS",
    "NAID",
  ];
  const countsByType = TYPE_ORDER.filter((t) => typeCounts.has(t)).map(
    (t) => ({ type: t, count: typeCounts.get(t) ?? 0 }),
  );

  return { citations, countsByType };
}

// ---------------------------------------------------------------------------
// ESTABLISHED FACTS
// ---------------------------------------------------------------------------

type EstablishedFactRow = {
  fact_id: string;
  topic_id: string;
  claim: string;
  long_form: string;
  supporting_naids: string[] | null;
  supporting_citations: string[] | null;
  category: string;
  confidence: string;
  sort_order: number | null;
};

export async function fetchEstablishedFactsIndex(): Promise<EstablishedFactsIndex> {
  if (useMockData()) return buildEstablishedFactsIndex();

  const rows = await query<EstablishedFactRow>(
    `SELECT *
       FROM \`${PROJECT}.${DATASET_CURATED}.established_facts\`
      ORDER BY confidence, topic_id, sort_order`,
  );

  const facts: EstablishedFact[] = rows.map((r) => {
    const topic = TOPIC_CATALOG[r.topic_id];
    return {
      id: r.fact_id,
      topicId: r.topic_id,
      topicTitle: topic?.title ?? null,
      topicHref: `/topic/${encodeURIComponent(r.topic_id)}`,
      claim: r.claim,
      longForm: r.long_form,
      supportingNaids: r.supporting_naids ?? [],
      supportingCitations: r.supporting_citations ?? [],
      category: r.category as EstablishedFactCategory,
      confidence: (r.confidence as EstablishedFactConfidence) ?? "Settled",
    };
  });

  const countsByConfidence: EstablishedFactsIndex["countsByConfidence"] = (
    ["Settled", "Well-supported", "Contested"] as EstablishedFactConfidence[]
  ).map((conf) => ({
    confidence: conf,
    count: facts.filter((f) => f.confidence === conf).length,
  }));

  const topicMap = new Map<string, { title: string | null; count: number }>();
  for (const f of facts) {
    const t = topicMap.get(f.topicId) ?? { title: f.topicTitle, count: 0 };
    t.count += 1;
    topicMap.set(f.topicId, t);
  }
  const countsByTopic = Array.from(topicMap.entries())
    .map(([topicId, v]) => ({ topicId, topicTitle: v.title, count: v.count }))
    .sort((a, b) => b.count - a.count);

  return { facts, countsByConfidence, countsByTopic };
}

// ---------------------------------------------------------------------------
// PHYSICAL EVIDENCE
// ---------------------------------------------------------------------------

type EvidenceRow = {
  evidence_id: string;
  category: string;
  short_name: string;
  long_description: string | null;
  chain_of_custody:
    | Array<{
        step_order: number;
        date: { value: string } | string | null;
        custodian: string;
        action: string;
      }>
    | null;
  referenced_naids: string[] | null;
  referenced_wc_testimony:
    | Array<{ volume: number; witness: string; page: number }>
    | null;
  related_entity_ids: string[] | null;
  image_url: string | null;
  image_credit: string | null;
  image_alt_text: string | null;
  canonical_copy_url: string | null;
  canonical_copy_host: string | null;
  sort_order: number | null;
};

function shortDescOf(long: string | null): string {
  if (!long) return "";
  const firstSentence = long.split(". ")[0];
  return firstSentence ? firstSentence.replace(/\.$/, "") + "." : "";
}

function nonEmpty(s: string | null | undefined): string | null {
  return s && s !== "" ? s : null;
}

function evidenceRowToCard(r: EvidenceRow): PhysicalEvidenceCard {
  return {
    id: r.evidence_id,
    category: r.category as PhysicalEvidenceCategory,
    shortName: r.short_name,
    href: `/evidence/${encodeURIComponent(r.evidence_id)}`,
    shortDescription: shortDescOf(r.long_description),
    imageUrl: nonEmpty(r.image_url),
    imageCredit: nonEmpty(r.image_credit),
    imageAlt: nonEmpty(r.image_alt_text),
  };
}

export async function fetchPhysicalEvidenceIndex(): Promise<PhysicalEvidenceIndex> {
  if (useMockData()) return buildPhysicalEvidenceIndex();

  const rows = await query<EvidenceRow>(
    `SELECT *
       FROM \`${PROJECT}.${DATASET_CURATED}.physical_evidence\`
      ORDER BY category, sort_order, short_name`,
  );
  const items = rows.map(evidenceRowToCard);
  const counts = new Map<PhysicalEvidenceCategory, number>();
  for (const it of items) counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
  const CATEGORY_ORDER: PhysicalEvidenceCategory[] = [
    "ballistic",
    "firearm",
    "photographic",
    "medical",
    "documentary",
    "clothing",
    "environmental",
  ];
  const categories = CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => ({
    category: c,
    count: counts.get(c) ?? 0,
  }));
  return { items, categories };
}

export async function fetchPhysicalEvidenceItem(
  id: string,
): Promise<PhysicalEvidenceDetail | null> {
  if (useMockData()) return buildPhysicalEvidenceItem(id);

  const rows = await query<EvidenceRow>(
    `SELECT *
       FROM \`${PROJECT}.${DATASET_CURATED}.physical_evidence\`
      WHERE evidence_id = @id
      LIMIT 1`,
    { id },
  );
  const r = rows[0];
  if (!r) return null;

  const entities = await loadEntities();
  const relatedEntities: EntityCard[] = (r.related_entity_ids ?? [])
    .map((slug) => entities.find((e) => e.entity_id === slug))
    .filter((e): e is EntityRow => !!e)
    .map((e) => entityRowToCard(e));

  const chainOfCustody = (r.chain_of_custody ?? []).map((s) => ({
    stepOrder: s.step_order,
    date:
      typeof s.date === "object" && s.date
        ? s.date.value
        : ((s.date as string | null) ?? null),
    custodian: s.custodian,
    action: s.action,
  }));

  return {
    ...evidenceRowToCard(r),
    longDescription: r.long_description ?? "",
    chainOfCustody,
    referencedNaids: r.referenced_naids ?? [],
    referencedWcTestimony: r.referenced_wc_testimony ?? [],
    relatedEntities,
    canonicalCopyUrl: nonEmpty(r.canonical_copy_url),
    canonicalCopyHost: nonEmpty(r.canonical_copy_host),
  };
}

// ---------------------------------------------------------------------------
// DEALEY PLAZA WITNESSES — sql/43.
// ---------------------------------------------------------------------------

export async function fetchDealeyPlazaWitnesses(): Promise<DealeyPlazaResponse> {
  if (useMockData()) return buildDealeyPlazaResponse();

  const rows = await query<{
    witness_id: string;
    name: string;
    position_lat: number;
    position_lng: number;
    position_description: string;
    statement_summary: string;
    heard_shots: number | null;
    shot_origin_perceived: string | null;
    wc_testimony_volume: number | null;
    wc_testimony_page: number | null;
    source_naids: string[] | null;
    role: string | null;
  }>(
    `SELECT witness_id, name, position_lat, position_lng,
            position_description, statement_summary, heard_shots,
            shot_origin_perceived, wc_testimony_volume,
            wc_testimony_page, source_naids, role
       FROM \`${PROJECT}.${DATASET_CURATED}.dealey_plaza_witnesses\`
      ORDER BY witness_id`,
  );
  const witnesses: DealeyPlazaWitness[] = rows.map((r) => ({
    witnessId: r.witness_id,
    name: r.name,
    positionLat: r.position_lat,
    positionLng: r.position_lng,
    positionDescription: r.position_description,
    statementSummary: r.statement_summary,
    heardShots: r.heard_shots,
    shotOriginPerceived: r.shot_origin_perceived,
    wcTestimonyVolume: r.wc_testimony_volume,
    wcTestimonyPage: r.wc_testimony_page,
    sourceNaids: r.source_naids ?? [],
    role: r.role,
  }));

  return {
    witnesses,
    bounds: computeDealeyPlazaBounds(witnesses),
  };
}

// ---------------------------------------------------------------------------
// Admin — redaction review queue (sql/44).
// ---------------------------------------------------------------------------

const DATASET_STAGING = "jfk_staging";

type RawQueueRow = {
  document_id: string;
  title: string | null;
  agency: string | null;
  release_set: string | null;
  num_pages: number | null;
  total_detections: number;
  unreviewed_count: number;
  confirmed_count: number;
  rejected_count: number;
  first_page: number;
  last_page: number;
  mean_confidence: number | null;
  max_area_pct: number | null;
  detection_method: string | null;
  review_priority: number;
};

function mapQueueItem(r: RawQueueRow): RedactionQueueItem {
  return {
    documentId: r.document_id,
    title: r.title,
    agency: r.agency,
    releaseSet: r.release_set,
    numPages: r.num_pages,
    totalDetections: Number(r.total_detections ?? 0),
    unreviewedCount: Number(r.unreviewed_count ?? 0),
    confirmedCount: Number(r.confirmed_count ?? 0),
    rejectedCount: Number(r.rejected_count ?? 0),
    firstPage: Number(r.first_page ?? 0),
    lastPage: Number(r.last_page ?? 0),
    meanConfidence: r.mean_confidence,
    maxAreaPct: r.max_area_pct,
    detectionMethod: r.detection_method,
    reviewPriority: Number(r.review_priority ?? 0),
  };
}

export async function fetchRedactionQueue(
  limit: number = 100,
): Promise<RedactionQueueResponse> {
  const rows = await query<RawQueueRow>(
    `
    SELECT *
    FROM \`${PROJECT}.${DATASET_STAGING}.docai_review_queue\`
    ORDER BY review_priority DESC, document_id
    LIMIT @limit
    `,
    { limit },
  );
  const items = rows.map(mapQueueItem);

  // Totals are computed off the full queue view, not just the page.
  const totals = await query<{ total_docs: number; total_unreviewed: number }>(
    `
    SELECT
      COUNT(*) AS total_docs,
      SUM(unreviewed_count) AS total_unreviewed
    FROM \`${PROJECT}.${DATASET_STAGING}.docai_review_queue\`
    `,
  );
  const t = totals[0] ?? { total_docs: 0, total_unreviewed: 0 };

  return {
    items,
    totalDocs: Number(t.total_docs ?? 0),
    totalUnreviewed: Number(t.total_unreviewed ?? 0),
  };
}

type RawDetectionRow = {
  redaction_id: string;
  page_num: number;
  bbox_x1: number;
  bbox_y1: number;
  bbox_x2: number;
  bbox_y2: number;
  area_pct: number | null;
  confidence: number | null;
  detection_method: string | null;
  review_status: string | null;
  reviewed_by: string | null;
  reviewed_at: { value: string } | string | null;
  reviewer_notes: string | null;
};

function asIso(v: { value: string } | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.value ?? null;
}

function mapDetection(r: RawDetectionRow): RedactionDetection {
  const status = (r.review_status || "unreviewed") as RedactionReviewStatus;
  return {
    redactionId: r.redaction_id,
    pageNum: Number(r.page_num),
    bboxX1: Number(r.bbox_x1),
    bboxY1: Number(r.bbox_y1),
    bboxX2: Number(r.bbox_x2),
    bboxY2: Number(r.bbox_y2),
    areaPct: r.area_pct,
    confidence: r.confidence,
    detectionMethod: r.detection_method,
    reviewStatus: status,
    reviewedBy: r.reviewed_by,
    reviewedAt: asIso(r.reviewed_at),
    reviewerNotes: r.reviewer_notes,
  };
}

export async function fetchRedactionDoc(
  documentId: string,
): Promise<RedactionDocDetail | null> {
  const meta = await query<{
    document_id: string;
    title: string | null;
    agency: string | null;
    release_set: string | null;
    num_pages: number | null;
  }>(
    `
    SELECT
      r.document_id,
      r.title,
      r.agency,
      COALESCE(d.release_set, r.release_set) AS release_set,
      COALESCE(d.num_pages, r.num_pages) AS num_pages
    FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r
    LEFT JOIN \`${PROJECT}.${DATASET_STAGING}.docai_documents\` d
      USING (document_id)
    WHERE r.document_id = @doc
    LIMIT 1
    `,
    { doc: documentId },
  );

  if (meta.length === 0) {
    // Orphan detections (doc not in jfk_records) are still reviewable if we
    // have rows in docai_redactions — synthesize a stub.
    const anyDet = await query<{ document_id: string }>(
      `
      SELECT document_id
      FROM \`${PROJECT}.${DATASET_STAGING}.docai_redactions\`
      WHERE document_id = @doc
      LIMIT 1
      `,
      { doc: documentId },
    );
    if (anyDet.length === 0) return null;
  }

  const detections = await query<RawDetectionRow>(
    `
    SELECT
      redaction_id, page_num,
      bbox_x1, bbox_y1, bbox_x2, bbox_y2,
      area_pct, confidence, detection_method,
      review_status, reviewed_by, reviewed_at, reviewer_notes
    FROM \`${PROJECT}.${DATASET_STAGING}.docai_redactions\`
    WHERE document_id = @doc
    ORDER BY page_num, bbox_y1, bbox_x1
    `,
    { doc: documentId },
  );

  const m = meta[0];
  const mapped = detections.map(mapDetection);
  const unreviewed = mapped.filter((d) => d.reviewStatus === "unreviewed").length;

  return {
    documentId,
    title: m?.title ?? null,
    agency: m?.agency ?? null,
    releaseSet: m?.release_set ?? null,
    numPages: m?.num_pages ?? null,
    totalDetections: mapped.length,
    unreviewedCount: unreviewed,
    detections: mapped,
  };
}

export async function applyRedactionAction(
  documentId: string,
  action: RedactionAction,
  reviewer: string,
): Promise<{ updated: number }> {
  const notes = action.notes ?? null;

  // confirm_all targets every unreviewed detection on the doc.
  if (action.type === "confirm_all") {
    const [job] = await bq().createQueryJob({
      query: `
        UPDATE \`${PROJECT}.${DATASET_STAGING}.docai_redactions\`
        SET review_status = 'confirmed',
            reviewed_by = @reviewer,
            reviewed_at = CURRENT_TIMESTAMP(),
            reviewer_notes = @notes
        WHERE document_id = @doc
          AND review_status = 'unreviewed'
      `,
      params: { doc: documentId, reviewer, notes },
      location: "US",
    });
    await job.getQueryResults();
    return { updated: Number(job.metadata?.statistics?.query?.numDmlAffectedRows ?? 0) };
  }

  const ids = action.redactionIds ?? [];
  if (ids.length === 0) return { updated: 0 };
  const statusMap: Record<RedactionActionType, RedactionReviewStatus> = {
    confirm: "confirmed",
    reject: "rejected",
    needs_split: "needs_split",
    confirm_all: "confirmed",
  };
  const newStatus = statusMap[action.type];

  const [job] = await bq().createQueryJob({
    query: `
      UPDATE \`${PROJECT}.${DATASET_STAGING}.docai_redactions\`
      SET review_status = @status,
          reviewed_by = @reviewer,
          reviewed_at = CURRENT_TIMESTAMP(),
          reviewer_notes = @notes
      WHERE document_id = @doc
        AND redaction_id IN UNNEST(@ids)
    `,
    params: { doc: documentId, status: newStatus, reviewer, notes, ids },
    location: "US",
  });
  await job.getQueryResults();
  return { updated: Number(job.metadata?.statistics?.query?.numDmlAffectedRows ?? 0) };
}

type RawOcrReleaseRow = {
  release_set: string;
  total_docs: number;
  pending_fetch: number;
  fetched: number;
  fetch_failed: number;
  pending_ocr: number;
  ocr_running: number;
  ocr_complete: number;
  ocr_failed: number;
  total_pages_complete: number | null;
  total_bytes_fetched: number | null;
  mean_confidence: number | null;
  last_update: { value: string } | string | null;
};

type RawOcrFailureRow = {
  document_id: string;
  release_set: string;
  fetch_status: string | null;
  docai_status: string | null;
  fetch_error: string | null;
  docai_error: string | null;
  updated_at: { value: string } | string;
};

function tsToIso(v: { value: string } | string | null): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return v.value ?? null;
}

export async function fetchOcrProgress(): Promise<OcrProgressResponse> {
  const perReleaseRows = await query<RawOcrReleaseRow>(
    `
    SELECT
      release_set,
      COUNT(*)                                                AS total_docs,
      COUNTIF(fetch_status = 'pending')                       AS pending_fetch,
      COUNTIF(fetch_status = 'fetched')                       AS fetched,
      COUNTIF(fetch_status = 'failed')                        AS fetch_failed,
      COUNTIF(docai_status = 'pending')                       AS pending_ocr,
      COUNTIF(docai_status = 'running')                       AS ocr_running,
      COUNTIF(docai_status = 'complete')                      AS ocr_complete,
      COUNTIF(docai_status = 'failed')                        AS ocr_failed,
      SUM(IF(docai_status = 'complete', page_count, 0))       AS total_pages_complete,
      SUM(IF(fetch_status = 'fetched', byte_size, 0))         AS total_bytes_fetched,
      AVG(IF(docai_status = 'complete', mean_page_conf, NULL)) AS mean_confidence,
      MAX(updated_at)                                         AS last_update
    FROM \`${PROJECT}.${DATASET_CURATED}.release_text_versions\`
    GROUP BY release_set
    ORDER BY release_set
    `,
  );

  const perRelease: OcrReleaseProgress[] = perReleaseRows.map((r) => ({
    releaseSet: r.release_set,
    totalDocs: Number(r.total_docs ?? 0),
    pendingFetch: Number(r.pending_fetch ?? 0),
    fetched: Number(r.fetched ?? 0),
    fetchFailed: Number(r.fetch_failed ?? 0),
    pendingOcr: Number(r.pending_ocr ?? 0),
    ocrRunning: Number(r.ocr_running ?? 0),
    ocrComplete: Number(r.ocr_complete ?? 0),
    ocrFailed: Number(r.ocr_failed ?? 0),
    totalPagesComplete: Number(r.total_pages_complete ?? 0),
    totalBytesFetched: Number(r.total_bytes_fetched ?? 0),
    meanConfidence: r.mean_confidence ?? null,
    lastUpdate: tsToIso(r.last_update),
  }));

  const overall = perRelease.reduce(
    (acc, p) => ({
      totalDocs: acc.totalDocs + p.totalDocs,
      fetched: acc.fetched + p.fetched,
      ocrComplete: acc.ocrComplete + p.ocrComplete,
      failed: acc.failed + p.fetchFailed + p.ocrFailed,
      totalPagesComplete: acc.totalPagesComplete + p.totalPagesComplete,
      totalBytesFetched: acc.totalBytesFetched + p.totalBytesFetched,
    }),
    {
      totalDocs: 0,
      fetched: 0,
      ocrComplete: 0,
      failed: 0,
      totalPagesComplete: 0,
      totalBytesFetched: 0,
    },
  );

  const failureRows = await query<RawOcrFailureRow>(
    `
    SELECT
      document_id, release_set, fetch_status, docai_status,
      fetch_error, docai_error, updated_at
    FROM \`${PROJECT}.${DATASET_CURATED}.release_text_versions\`
    WHERE fetch_status = 'failed' OR docai_status = 'failed'
    ORDER BY updated_at DESC
    LIMIT 25
    `,
  );

  const recentFailures: OcrFailureItem[] = failureRows.map((r) => ({
    documentId: r.document_id,
    releaseSet: r.release_set,
    fetchStatus: r.fetch_status,
    docaiStatus: r.docai_status,
    fetchError: r.fetch_error,
    docaiError: r.docai_error,
    updatedAt: tsToIso(r.updated_at) ?? "",
  }));

  return {
    perRelease,
    overall,
    recentFailures,
    generatedAt: new Date().toISOString(),
  };
}
