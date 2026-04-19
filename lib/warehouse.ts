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
  CitationEntry,
  CitationType,
  CooccurrenceGraph,
  CooccurrenceLink,
  CooccurrenceNode,
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

  const [docRows, entityDocCount, coOccurrence, sourceRows, factRows] = await Promise.all([
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
  ]);

  const sources: EntitySource[] = sourceRows.map((s) => ({
    label: s.label,
    url: s.url,
    kind: s.kind,
    note: s.note,
  }));

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
    timeline: slug === "oswald" ? oswaldTimeline() : [],
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
}: {
  query: string;
  mode: "document" | "mention" | "semantic";
  filters?: SearchFilters;
  limit?: number;
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
       LIMIT ${Number(limit)}`,
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

  // Mention mode: return real OCR passages first, fall back to title/description.
  let mentionResults: SearchResult[] = [];
  if (mode === "mention" && qNorm) {
    const ocrRows = await query<{
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
        LIMIT ${Number(limit)}`,
      params,
    );
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

    // If OCR yielded too few, pad with metadata hits (title/description).
    if (mentionResults.length < 8) {
      const metaRows = await query<RecordRow & {
        entity_id: string;
        confidence: ConfidenceLevel;
        match_source: string;
      }>(
        `SELECT r.*, m.entity_id, m.confidence, m.match_source
           FROM \`${PROJECT}.${DATASET_CURATED}.jfk_records\` r
           JOIN \`${PROJECT}.${DATASET_CURATED}.jfk_document_entity_map\` m
             USING (document_id)
          WHERE (LOWER(r.title) LIKE @qLike OR LOWER(r.description) LIKE @qLike)
          ORDER BY m.score DESC, r.start_date DESC
          LIMIT ${Number(limit)}`,
        params,
      );
      for (const r of metaRows) {
        mentionResults.push({
          kind: "mention",
          mention: {
            id: `mx-${r.document_id}-${r.entity_id}`,
            documentId: r.document_id,
            documentTitle: r.title,
            documentHref: `/document/${encodeURIComponent(r.document_id)}`,
            excerpt: r.description || r.title,
            matchedTerms: [qNorm],
            confidence: r.confidence,
            source: r.match_source === "title" ? "title" : "description",
            pageLabel: null,
          },
        });
      }
    }
  }

  return {
    query: qNorm,
    mode,
    total: mode === "mention" ? mentionResults.length : (total[0]?.n ?? 0),
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

  const [articleRows, threadRows, footnoteRows] = await Promise.all([
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
    }>(
      `SELECT batch_num, question_index, question, summary, tension_type,
              supporting_doc_ids
         FROM \`${PROJECT}.${DATASET_CURATED}.jfk_topic_batch_questions\`
        WHERE slug = @slug
        ORDER BY
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

  const threads: OpenQuestionThread[] = threadRows.map((t) => ({
    id: `q-${t.batch_num}-${t.question_index}`,
    question: t.question,
    summary: t.summary,
    tensionType: t.tension_type,
    supportingDocIds: t.supporting_doc_ids ?? [],
  }));

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

  return {
    slug,
    title: catalog.title,
    eyebrow: catalog.eyebrow,
    topicHref: `/topic/${slug}`,
    article,
    questionCount: threads.length,
    threads,
    editorialFootnotes,
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
  const rows = await query<CaseTimelineRow>(
    `SELECT event_id, event_date, event_time_local, title, description,
            category, related_entity_ids, related_topic_ids,
            source_external, importance
       FROM \`${PROJECT}.${DATASET_CURATED}.timeline_events\`
      ORDER BY event_date, event_time_local NULLS FIRST`,
  );

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
// Oswald timeline — static, authored
// ---------------------------------------------------------------------------

function oswaldTimeline() {
  return [
    {
      id: "t-oswald-birth",
      date: "1939-10-18",
      dateLabel: "October 18, 1939",
      title: "Born in New Orleans, Louisiana",
      description:
        "Lee Harvey Oswald is born at Old French Hospital, New Orleans, to Marguerite Claverie Oswald.",
    },
    {
      id: "t-oswald-marines",
      date: "1956-10-24",
      dateLabel: "October 24, 1956",
      title: "Enlists in the U.S. Marine Corps",
      description:
        "Enlists in Dallas at age 17; reports to the Marine Corps Recruit Depot, San Diego, on October 26, 1956. Trains in aviation electronics and is later assigned as a radar operator at MCAS Atsugi, Japan.",
    },
    {
      id: "t-oswald-defection",
      date: "1959-10-31",
      dateLabel: "October 31, 1959",
      title: "Renounces U.S. citizenship in Moscow",
      description:
        "Appears at the U.S. Embassy in Moscow and declares his intent to renounce U.S. citizenship. The CIA opens a 201 personality file on Oswald in December 1960.",
    },
    {
      id: "t-oswald-return",
      date: "1962-06-13",
      dateLabel: "June 13, 1962",
      title: "Returns to the United States",
      description:
        "Arrives in New York with Marina and infant daughter June; interviewed at Idlewild Airport by FBI. Settles first in Fort Worth, then Dallas.",
    },
    {
      id: "t-oswald-walker",
      date: "1963-04-10",
      dateLabel: "April 10, 1963",
      title: "Alleged shooting at General Walker's residence",
      description:
        "A rifle shot is fired through the dining-room window of Major General Edwin A. Walker's Dallas home. Warren Commission and ARRB records attribute the shot to Oswald.",
    },
    {
      id: "t-oswald-mexico",
      date: "1963-09-27",
      dateLabel: "September 27 – October 2, 1963",
      title: "Visits Mexico City",
      description:
        "Travels to Mexico City and visits the Cuban consulate and the Soviet embassy. CIA station cables record the contact; no visa is issued.",
    },
    {
      id: "t-oswald-assassination",
      date: "1963-11-22",
      dateLabel: "November 22, 1963",
      title: "Assassination of President Kennedy",
      description:
        "President Kennedy is fatally shot in Dealey Plaza, Dallas, at 12:30 p.m. local time. Oswald is arrested at the Texas Theatre at 1:50 p.m.",
    },
    {
      id: "t-oswald-tippit",
      date: "1963-11-22",
      dateLabel: "November 22, 1963 (1:15 p.m.)",
      title: "Murder of Officer J. D. Tippit",
      description:
        "Dallas Police Officer J. D. Tippit is shot and killed at East 10th Street and Patton Avenue in Oak Cliff. Nine eyewitnesses later identify Oswald as the gunman in lineups or photo arrays; Oswald is charged the same day with both the Tippit and Kennedy murders.",
    },
    {
      id: "t-oswald-killed",
      date: "1963-11-24",
      dateLabel: "November 24, 1963",
      title: "Shot and killed by Jack Ruby",
      description:
        "During a jail transfer in the basement of Dallas Police Headquarters, Oswald is shot by Jack Ruby, a Dallas nightclub owner. He is pronounced dead at Parkland Hospital.",
    },
  ];
}
