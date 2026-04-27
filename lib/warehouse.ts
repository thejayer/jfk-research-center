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
  DocumentResponse,
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
  MentionExcerpt,
  OpenQuestionThread,
  OpenQuestionsArticle,
  OpenQuestionsIndexResponse,
  OpenQuestionsTopicCard,
  OpenQuestionsTopicResponse,
  SearchResponse,
  SearchResult,
  TopicCard,
  TopicDetail,
  TopicResponse,
} from "./api-types";
import { formatDate } from "./format";

const PROJECT = process.env.JFK_BQ_PROJECT || "jfk-vault";
const DATASET_CURATED = "jfk_curated";
const DATASET_MVP = "jfk_mvp";

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
  const [rows] = await bq().query({
    query: sql,
    params,
    location: "US",
  });
  return rows as T[];
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
  return {
    id: r.document_id,
    naid: r.naid,
    title: r.title,
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
  ocr?: { chunkCount: number; firstChunk: string | null; hasAbbyy: boolean },
): DocumentDetail {
  const card = rowToCard(r);
  return {
    ...card,
    description: r.description,
    recordGroup: r.record_group,
    collectionName: r.collection_name,
    startDate: readDate(r.start_date),
    endDate: readDate(r.end_date),
    sourceUrl: r.source_url,
    digitalObjectUrl: r.digital_object_url,
    thumbnailUrl: r.thumbnail_url,
    pageCount: r.num_pages ?? r.pages_released ?? null,
    chunkCount: ocr?.chunkCount ?? 0,
    ocrExcerpt: ocr?.firstChunk ?? null,
    hasOcr: ocr?.hasAbbyy ?? !!r.has_ocr,
    citation: r.record_group
      ? `NAID ${r.naid} · ${r.record_group}`
      : `NAID ${r.naid} · JFK Assassination Records Collection`,
    releaseHistory: readReleaseHistory(r.release_history),
  };
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

async function loadEntities(): Promise<EntityRow[]> {
  return query<EntityRow>(
    `SELECT entity_id, entity_name, entity_type, aliases, summary,
            description, headline, born, died, active_years, sort_order
       FROM \`${PROJECT}.${DATASET_CURATED}.jfk_entities\`
      ORDER BY sort_order`,
  );
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

// ---------------------------------------------------------------------------
// HOME
// ---------------------------------------------------------------------------

export async function fetchHome(): Promise<HomeResponse> {
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
      coverageNote: "",
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
  return {
    totalRecords: Number(r.total_records ?? 0),
    recordsWithOcr: Number(r.records_with_ocr ?? 0),
    ocrPassages: Number(r.ocr_passages ?? 0),
    latestIndexedReleaseDate: latestStr ?? null,
    releasesIndexed: knownReleases.filter((k) => k.flag).map((k) => k.set),
    releasesPending: knownReleases.filter((k) => !k.flag).map((k) => k.set),
    recordsByRelease,
    recordsWith2025Ocr: Number(r.records_with_2025_ocr ?? 0),
    coverageNote: "",
  };
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
  const counts = await topicCountsMap();
  return TOPIC_DISPLAY_ORDER.map((slug) =>
    topicToCard(slug, counts.get(slug) ?? 0),
  );
}

export async function fetchAllEntities(): Promise<EntityCard[]> {
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
       WHERE c.source_type = 'abbyy_ocr'
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
        documentTitle: r.title,
        documentHref: `/document/${encodeURIComponent(r.document_id)}#chunk-${ocr.chunk_order}`,
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
      documentTitle: r.title,
      documentHref: `/document/${encodeURIComponent(r.document_id)}`,
      excerpt: r.description || r.title,
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
  const t = TOPIC_CATALOG[slug];
  if (!t) return null;

  const [docs, count, entityCoOcc, aiRows, articleRows] = await Promise.all([
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
    documentTitle: r.title,
    documentHref: `/document/${encodeURIComponent(r.document_id)}`,
    excerpt: r.description || r.title,
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

  return {
    topic,
    relatedEntities,
    topDocuments: docs.map((r) => rowToCard(r)),
    mentionExcerpts,
  };
}

// ---------------------------------------------------------------------------
// DOCUMENT
// ---------------------------------------------------------------------------

export async function fetchDocument(id: string): Promise<DocumentResponse | null> {
  const rows = await query<RecordRow>(
    `SELECT * FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\` WHERE document_id = @id`,
    { id },
  );
  const doc = rows[0];
  if (!doc) return null;

  const [mapRows, related, ocrChunks] = await Promise.all([
    query<{
      entity_id: string;
      confidence: ConfidenceLevel;
      match_source: string;
    }>(
      `SELECT entity_id, confidence, match_source
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
        WHERE document_id = @id`,
      { id },
    ),
    query<RecordRow>(
      `WITH this_entities AS (
         SELECT entity_id
           FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
          WHERE document_id = @id
       ),
       candidates AS (
         SELECT m.document_id, COUNT(*) AS shared
           FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\` m
           JOIN this_entities USING (entity_id)
          WHERE m.document_id != @id
          GROUP BY m.document_id
          ORDER BY shared DESC
          LIMIT 6
       )
       SELECT r.*
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r
         JOIN candidates USING (document_id)`,
      { id },
    ),
    query<{
      chunk_id: string;
      chunk_order: number;
      chunk_text: string;
      page_label: string | null;
      source_type: string;
    }>(
      `SELECT chunk_id, chunk_order, chunk_text, page_label, source_type
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_text_chunks\`
        WHERE document_id = @id
        ORDER BY chunk_order
        LIMIT 12`,
      { id },
    ),
  ]);

  const entities = await loadEntities();
  const relatedEntities = mapRows
    .map((m) => {
      const e = entities.find((x) => x.entity_id === m.entity_id);
      return e ? entityRowToCard(e) : null;
    })
    .filter((e): e is EntityCard => !!e);

  const abbyyChunks = ocrChunks.filter((c) => c.source_type === "abbyy_ocr");
  const hasAbbyy = abbyyChunks.length > 0;

  // When ABBYY OCR is available, surface real passages that contain an alias.
  // Otherwise fall back to the entity-map row with the NARA description/title.
  const mentions: MentionExcerpt[] = [];

  if (hasAbbyy) {
    for (const m of mapRows) {
      const e = entities.find((x) => x.entity_id === m.entity_id);
      const aliases = e?.aliases ?? [];
      const aliasRe = buildAliasRegex(aliases);
      const hit = aliasRe
        ? abbyyChunks.find((c) => aliasRe.test(c.chunk_text))
        : null;
      if (hit) {
        mentions.push({
          id: `m-${m.entity_id}-${hit.chunk_id}`,
          documentId: id,
          documentTitle: doc.title,
          documentHref: `/document/${encodeURIComponent(id)}#chunk-${hit.chunk_order}`,
          excerpt: truncateAround(hit.chunk_text, aliases, 280),
          matchedTerms: aliases.slice(0, 3),
          confidence: m.confidence,
          source: "ocr",
          pageLabel: hit.page_label,
          chunkOrder: hit.chunk_order,
        });
      } else {
        mentions.push({
          id: `m-${m.entity_id}-${id}`,
          documentId: id,
          documentTitle: doc.title,
          documentHref: `/document/${encodeURIComponent(id)}`,
          excerpt: doc.description || doc.title,
          matchedTerms: aliases.slice(0, 3),
          confidence: m.confidence,
          source:
            m.match_source === "title" ? "title" : "description",
          pageLabel: null,
        });
      }
    }
  } else {
    for (const m of mapRows.slice(0, 6)) {
      const e = entities.find((x) => x.entity_id === m.entity_id);
      const aliases = e?.aliases ?? [];
      mentions.push({
        id: `m-${m.entity_id}-${id}`,
        documentId: id,
        documentTitle: doc.title,
        documentHref: `/document/${encodeURIComponent(id)}`,
        excerpt: doc.description || doc.title,
        matchedTerms: aliases.slice(0, 3),
        confidence: m.confidence,
        source: m.match_source === "title" ? "title" : "description",
        pageLabel: null,
      });
    }
  }

  return {
    document: rowToDetail(doc, {
      chunkCount: abbyyChunks.length,
      firstChunk: abbyyChunks[0]?.chunk_text ?? null,
      hasAbbyy,
    }),
    mentions: mentions.slice(0, 8),
    relatedEntities,
    relatedDocuments: related.map((r) => rowToCard(r)),
  };
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

type SearchFilters = {
  agencies?: string[];
  yearFrom?: number | null;
  yearTo?: number | null;
  topics?: string[];
  entities?: string[];
  confidence?: ConfidenceLevel[];
};

export async function fetchSearch({
  query: q,
  mode,
  filters = {},
  limit = 50,
  offset = 0,
}: {
  query: string;
  mode: "document" | "mention" | "semantic";
  filters?: SearchFilters;
  limit?: number;
  /** Document mode only. Mention/semantic ignore this. */
  offset?: number;
}): Promise<SearchResponse> {
  if (mode === "semantic") {
    return fetchSemanticSearch({ query: q, limit });
  }
  const qNorm = q.trim();
  const params: Record<string, unknown> = {
    qNorm,
    qLike: qNorm ? `%${qNorm.toLowerCase()}%` : "%",
  };

  const where: string[] = [];
  // match_confidence is NULL when the query is empty; this clause also
  // enforces "must actually match the query" when a query is present.
  if (qNorm) where.push("match_confidence IS NOT NULL");

  if (filters.confidence?.length && qNorm) {
    where.push("match_confidence IN UNNEST(@confidences)");
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
    // and is not a documentary topic. Silently drop it from the filter
    // (a user could only land here by hand-crafting the URL).
    const unionSql = filters.topics
      .filter((slug) => TOPIC_CATALOG[slug] && MVP_QUERYABLE_TOPIC_SLUGS.includes(slug))
      .map(
        (slug) =>
          `SELECT document_id FROM \`${PROJECT}.${DATASET_MVP}.${TOPIC_CATALOG[slug]!.mvpTable}\``,
      )
      .join(" UNION ALL ");
    if (unionSql) where.push(`document_id IN (${unionSql})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Shared CTE: compute per-doc match_confidence based on where the query
  // landed — title (high) > description (medium) > OCR chunks (low). The
  // results query and the total-count query both read from `scored`.
  const cteSql = `
    WITH doc_with_ocr_hit AS (
      SELECT document_id, ANY_VALUE(chunk_text) AS hit_text
        FROM \`${PROJECT}.${DATASET_CURATED}.jfk_text_chunks\`
       WHERE source_type = 'abbyy_ocr' AND @qNorm != '' AND LOWER(chunk_text) LIKE @qLike
       GROUP BY document_id
    ),
    scored AS (
      SELECT r.*, o.hit_text AS ocr_hit_text,
        CASE
          WHEN @qNorm = '' THEN CAST(NULL AS STRING)
          WHEN LOWER(r.title) LIKE @qLike THEN 'high'
          WHEN LOWER(r.description) LIKE @qLike THEN 'medium'
          WHEN o.document_id IS NOT NULL THEN 'low'
        END AS match_confidence
      FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r
      LEFT JOIN doc_with_ocr_hit o USING (document_id)
    )
  `;

  const [results, filterData] = await Promise.all([
    query<
      RecordRow & { ocr_hit_text: string | null; match_confidence: ConfidenceLevel | null }
    >(
      `${cteSql}
       SELECT * FROM scored
       ${whereSql}
       ORDER BY
         CASE match_confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
         start_date DESC NULLS LAST
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params,
    ),
    loadSearchFacets(),
  ]);

  const total = await query<{ n: number }>(
    `${cteSql}
     SELECT COUNT(*) AS n FROM scored ${whereSql}`,
    params,
  );

  const docResults: SearchResult[] = results.map((r) => {
    const snippet = r.ocr_hit_text
      ? truncateAround(r.ocr_hit_text, [qNorm], 260)
      : undefined;
    return {
      kind: "document",
      document: rowToCard(r, snippet),
      mentionCount: 0,
      confidence: (r.match_confidence ?? "none") as ConfidenceLevel,
    };
  });

  // Mention mode: OCR passage hits only. Paginated by offset; total is
  // the real COUNT(*) of matching chunks. Metadata-only hits (title/
  // description without OCR) live in Documents mode.
  let mentionResults: SearchResult[] = [];
  let mentionTotal = 0;
  if (mode === "mention" && qNorm) {
    const [ocrRows, ocrTotal] = await Promise.all([
      query<{
        document_id: string;
        naid: string;
        title: string;
        chunk_id: string;
        chunk_order: number;
        chunk_text: string;
        page_label: string | null;
      }>(
        `SELECT r.document_id, r.naid, r.title,
                c.chunk_id, c.chunk_order, c.chunk_text, c.page_label
           FROM \`${PROJECT}.${DATASET_CURATED}.jfk_text_chunks\` c
           JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r
             USING (document_id)
          WHERE c.source_type = 'abbyy_ocr'
            AND LOWER(c.chunk_text) LIKE @qLike
          ORDER BY c.document_id, c.chunk_order
          LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
        params,
      ),
      query<{ n: number }>(
        `SELECT COUNT(*) AS n
           FROM \`${PROJECT}.${DATASET_CURATED}.jfk_text_chunks\` c
          WHERE c.source_type = 'abbyy_ocr'
            AND LOWER(c.chunk_text) LIKE @qLike`,
        params,
      ),
    ]);
    mentionResults = ocrRows.map((r) => ({
      kind: "mention",
      mention: {
        id: `mx-${r.chunk_id}`,
        documentId: r.document_id,
        documentTitle: r.title,
        documentHref: `/document/${encodeURIComponent(r.document_id)}#chunk-${r.chunk_order}`,
        excerpt: truncateAround(r.chunk_text, [qNorm], 280),
        matchedTerms: [qNorm],
        confidence: "low",
        source: "ocr",
        pageLabel: r.page_label,
        chunkOrder: r.chunk_order,
      },
    }));
    mentionTotal = ocrTotal[0]?.n ?? 0;
  }

  return {
    query: qNorm,
    mode,
    total: mode === "mention" ? mentionTotal : (total[0]?.n ?? 0),
    filters: filterData,
    results: mode === "mention" ? mentionResults : docResults,
  };
}

// ---------------------------------------------------------------------------
// SEMANTIC SEARCH — Phase 5-A. Embeds the query with RETRIEVAL_QUERY task
// type and runs VECTOR_SEARCH against the chunk_embeddings table built by
// sql/31. Returns MentionExcerpt-shaped results so the existing search UI
// can render them without a new card component; the `score` field carries
// the cosine-based relevance (1 - distance), higher = better.
// ---------------------------------------------------------------------------

type SemanticHitRow = {
  chunk_id: string;
  chunk_order: number;
  document_id: string;
  naid: string;
  page_label: string | null;
  distance: number;
  title: string;
  chunk_text: string;
};

async function fetchSemanticSearch({
  query: q,
  limit,
}: {
  query: string;
  limit: number;
}): Promise<SearchResponse> {
  const facets = await loadSearchFacets();
  const qNorm = q.trim();
  if (!qNorm) {
    return {
      query: "",
      mode: "semantic",
      total: 0,
      filters: facets,
      results: [],
    };
  }

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
        top_k => @limit,
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
      c.chunk_text
    FROM hits h
    JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r USING (document_id)
    JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_text_chunks\` c USING (chunk_id)
    ORDER BY h.distance ASC
    `,
    { q: qNorm, limit },
  );

  const results: SearchResult[] = rows.map((r) => ({
    kind: "mention",
    mention: {
      id: `sem-${r.chunk_id}`,
      documentId: r.document_id,
      documentTitle: r.title,
      documentHref: `/document/${encodeURIComponent(r.document_id)}#chunk-${r.chunk_order}`,
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

const COOC_YEAR_MIN = 1950;
const COOC_YEAR_MAX = 2005;

type CooccurrenceRow = {
  entity_a: string;
  entity_b: string;
  n: number;
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
  const lo = Math.max(COOC_YEAR_MIN, Math.min(yearFrom, yearTo));
  const hi = Math.min(COOC_YEAR_MAX, Math.max(yearFrom, yearTo));

  const [pairRows, entities] = await Promise.all([
    query<CooccurrenceRow>(
      `SELECT entity_a, entity_b, SUM(cooccurrence_count) AS n
         FROM \`${PROJECT}.${DATASET_CURATED}.entity_cooccurrence\`
        WHERE year BETWEEN @lo AND @hi
        GROUP BY entity_a, entity_b
        HAVING n >= @minCount
        ORDER BY n DESC`,
      { lo, hi, minCount },
    ),
    loadEntities(),
  ]);

  const connectedIds = new Set<string>();
  const degreeById = new Map<string, number>();
  const links: CooccurrenceLink[] = pairRows.map((r) => {
    connectedIds.add(r.entity_a);
    connectedIds.add(r.entity_b);
    degreeById.set(r.entity_a, (degreeById.get(r.entity_a) ?? 0) + 1);
    degreeById.set(r.entity_b, (degreeById.get(r.entity_b) ?? 0) + 1);
    return { source: r.entity_a, target: r.entity_b, count: r.n };
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

  return {
    nodes,
    links,
    yearBounds: { min: COOC_YEAR_MIN, max: COOC_YEAR_MAX },
    appliedRange: { yearFrom: lo, yearTo: hi },
  };
}

async function loadSearchFacets() {
  const topicCountsUnion = MVP_QUERYABLE_TOPIC_SLUGS
    .map(
      (slug) =>
        `SELECT '${slug}' AS slug, COUNT(*) AS n
         FROM \`${PROJECT}.${DATASET_MVP}.${TOPIC_CATALOG[slug]!.mvpTable}\``,
    )
    .join(" UNION ALL ");

  const [years, agencies, entityMeta, entityCountRows, topicCountRows] =
    await Promise.all([
      query<{ y: string; n: number }>(
        `SELECT CAST(EXTRACT(YEAR FROM start_date) AS STRING) AS y,
                COUNT(*) AS n
           FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\`
          WHERE start_date IS NOT NULL
            AND EXTRACT(YEAR FROM start_date) BETWEEN 1950 AND 2005
          GROUP BY y
          ORDER BY y DESC`,
      ),
      query<{ agency: string; n: number }>(
        `SELECT agency, COUNT(*) AS n
           FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\`
          WHERE agency IS NOT NULL
          GROUP BY agency
         HAVING n >= 2
          ORDER BY n DESC`,
      ),
      loadEntities(),
      query<{ entity_id: string; n: number }>(
        `SELECT entity_id, COUNT(DISTINCT document_id) AS n
           FROM \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\`
          GROUP BY entity_id`,
      ),
      query<{ slug: string; n: number }>(topicCountsUnion),
    ]);

  const entityCountMap = Object.fromEntries(
    entityCountRows.map((r) => [r.entity_id, r.n]),
  );
  const entityIds = [...entityMeta].sort(
    (a, b) =>
      (entityCountMap[b.entity_id] ?? 0) - (entityCountMap[a.entity_id] ?? 0),
  );

  // Expand the sparse year-count rows into a dense series over the full
  // [min, max] range so the slider histogram can render zero-bars for
  // uneventful years instead of collapsing the axis.
  const countedYears = years.map((r) => parseInt(r.y, 10)).filter(
    (n): n is number => Number.isFinite(n),
  );
  const yearMin = countedYears.length ? Math.min(...countedYears) : 1950;
  const yearMax = countedYears.length ? Math.max(...countedYears) : 2005;
  const yearSeries: string[] = [];
  for (let y = yearMin; y <= yearMax; y++) yearSeries.push(String(y));
  const yearCountMap: Record<string, number> = {};
  for (const y of yearSeries) yearCountMap[y] = 0;
  for (const r of years) yearCountMap[r.y] = r.n;

  return {
    years: yearSeries,
    yearCounts: yearCountMap,
    yearBounds: { min: yearMin, max: yearMax },
    agencies: agencies.map((r) => r.agency),
    agencyCounts: Object.fromEntries(agencies.map((r) => [r.agency, r.n])),
    topics: MVP_QUERYABLE_TOPIC_SLUGS,
    topicLabels: Object.fromEntries(
      MVP_QUERYABLE_TOPIC_SLUGS.map((slug) => [slug, TOPIC_CATALOG[slug]!.title]),
    ),
    topicCounts: Object.fromEntries(topicCountRows.map((r) => [r.slug, r.n])),
    entities: entityIds.map((e) => e.entity_id),
    entityLabels: Object.fromEntries(
      entityIds.map((e) => [e.entity_id, e.entity_name]),
    ),
    entityCounts: entityCountMap,
    confidence: ["high", "medium", "low"] as ConfidenceLevel[],
  };
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
    }>(
      `SELECT d.event_id, d.document_id, d.note, r.title
         FROM \`${PROJECT}.${DATASET_CURATED}.timeline_event_documents\` d
         LEFT JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r
           USING (document_id)
        ORDER BY d.event_id, d.sort_order`,
    ),
  ]);

  const docLinksByEvent = new Map<string, CaseTimelineEvent["documentLinks"]>();
  for (const r of docLinkRows) {
    const list = docLinksByEvent.get(r.event_id) ?? [];
    list.push({ documentId: r.document_id, title: r.title, note: r.note });
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

  // Compute the bounding box with a small pad so witnesses near the
  // edge aren't visually pinned against the SVG border.
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const w of witnesses) {
    if (w.positionLat < minLat) minLat = w.positionLat;
    if (w.positionLat > maxLat) maxLat = w.positionLat;
    if (w.positionLng < minLng) minLng = w.positionLng;
    if (w.positionLng > maxLng) maxLng = w.positionLng;
  }
  const padLat = (maxLat - minLat) * 0.08 || 0.0005;
  const padLng = (maxLng - minLng) * 0.08 || 0.0005;
  return {
    witnesses,
    bounds: {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng,
    },
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
