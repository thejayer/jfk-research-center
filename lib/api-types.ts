/**
 * Canonical UI-facing contract types.
 *
 * These shapes are the boundary between the API layer and the frontend.
 * The warehouse (BigQuery) produces different column names; API handlers
 * must adapt into these shapes so the UI never knows warehouse internals.
 */

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export type DocumentCard = {
  id: string;
  naid: string;
  title: string;
  subtitle?: string | null;
  snippet?: string | null;
  href: string;
  tags: string[];
  agency?: string | null;
  date?: string | null;
  dateLabel?: string | null;
  documentType?: string | null;
  hasOcr?: boolean;
};

export type ReleaseHistoryEntry = {
  releaseSet: string;
  releaseDate: string | null;
  isOcrSource: boolean;
};

export type DocumentDetail = DocumentCard & {
  description?: string | null;
  recordGroup?: string | null;
  collectionName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sourceUrl?: string | null;
  digitalObjectUrl?: string | null;
  thumbnailUrl?: string | null;
  pageCount?: number | null;
  chunkCount?: number | null;
  ocrExcerpt?: string | null;
  ocrPages?: OcrPage[];
  citation?: string | null;
  /** All releases this record appeared in, earliest to latest. */
  releaseHistory?: ReleaseHistoryEntry[];
};

export type OcrPage = {
  pageLabel: string;
  text: string;
  matchedTerms?: string[];
};

export type EntityCard = {
  slug: string;
  name: string;
  type: "person" | "org" | "place" | "concept";
  summary: string;
  documentCount?: number;
  mentionCount?: number;
  href: string;
  aliases?: string[];
};

export type EntityDetail = EntityCard & {
  aliases: string[];
  born?: string | null;
  died?: string | null;
  activeYears?: string | null;
  headline?: string | null;
  description: string;
};

export type TopicCard = {
  slug: string;
  title: string;
  summary: string;
  documentCount: number;
  href: string;
  eyebrow?: string;
};

export type TopicDetail = TopicCard & {
  description: string;
  relatedSlugs?: string[];
  aiSummary?: {
    text: string;
    model: string;
    generatedAt: string;
    sourceDocCount: number;
  };
  aiArticle?: {
    text: string;
    model: string;
    generatedAt: string;
    sourceDocCount: number;
  };
};

export type TimelineEvent = {
  id: string;
  date: string;
  dateLabel: string;
  title: string;
  description: string;
  relatedDocumentIds?: string[];
};

export type MentionExcerpt = {
  id: string;
  documentId: string;
  documentTitle: string;
  documentHref: string;
  excerpt: string;
  matchedTerms: string[];
  confidence: ConfidenceLevel;
  source: "title" | "description" | "ocr" | "authority" | "semantic";
  pageLabel?: string | null;
  /** 1-based per-document chunk ordinal; backs the #chunk-N anchor. */
  chunkOrder?: number | null;
  /** Semantic similarity score in [0, 1]; higher is more relevant. */
  score?: number | null;
};

export type SearchResult =
  | { kind: "document"; document: DocumentCard; mentionCount: number; confidence: ConfidenceLevel; }
  | { kind: "mention"; mention: MentionExcerpt };

export type SearchFilters = {
  // Event-date histogram (one entry per year within yearBounds) backs the
  // /search year range slider.
  years: string[];
  yearCounts: Record<string, number>;
  yearBounds: { min: number; max: number };
  agencies: string[];
  agencyCounts: Record<string, number>;
  // topics/entities values are stable slugs/ids used in URLs and BQ filters;
  // the sidebar renders labels[id] for display.
  topics: string[];
  topicLabels: Record<string, string>;
  topicCounts: Record<string, number>;
  entities: string[];
  entityLabels: Record<string, string>;
  entityCounts: Record<string, number>;
  confidence: ConfidenceLevel[];
};

/** Filter values applied to a search — shape used by fetchSearch. */
export type SearchFilterInput = {
  agencies?: string[];
  yearFrom?: number | null;
  yearTo?: number | null;
  topics?: string[];
  entities?: string[];
  confidence?: ConfidenceLevel[];
};

// ---------------------------------------------------------------------------
// Entity co-occurrence graph — Phase 5-C.
// ---------------------------------------------------------------------------

export type CooccurrenceNode = {
  id: string; // entity_id / slug
  name: string;
  type: "person" | "org" | "place" | "concept";
  degree: number; // count of distinct peers this node connects to in range
};

export type CooccurrenceLink = {
  source: string;
  target: string;
  count: number; // total co-occurring documents within year range
};

export type CooccurrenceGraph = {
  nodes: CooccurrenceNode[];
  links: CooccurrenceLink[];
  yearBounds: { min: number; max: number };
  appliedRange: { yearFrom: number; yearTo: number };
};

export type CorpusManifest = {
  totalRecords: number;
  recordsWithOcr: number;
  /** Total OCR passages (abbyy_ocr chunks) across the corpus. */
  ocrPassages: number;
  latestIndexedReleaseDate: string | null;
  releasesIndexed: string[];
  releasesPending: string[];
  /** Per-release record counts, keyed by release label (e.g. "2025"). */
  recordsByRelease: Record<string, number>;
  /** Records whose OCR content was sourced from the 2025 re-release. */
  recordsWith2025Ocr: number;
  coverageNote: string;
};

export type HomeResponse = {
  stats: {
    documentCount: number;
    mentionCount: number;
    entityCount: number;
    topicCount: number;
  };
  featuredEntities: EntityCard[];
  featuredTopics: TopicCard[];
  recentDocuments: DocumentCard[];
  corpusManifest: CorpusManifest;
};

export type SearchResponse = {
  query: string;
  mode: "document" | "mention" | "semantic";
  total: number;
  filters: SearchFilters;
  results: SearchResult[];
};

export type EntitySource = {
  label: string;
  url: string | null;
  kind: string;
  note?: string | null;
};

export type EntityFact = {
  key: string;
  value: string;
  effectiveDate: string | null;
  sourceType: string;
  sourceRef: string;
  confidence: "High" | "Medium" | "Low";
};

export type EntityResponse = {
  entity: EntityDetail;
  timeline: TimelineEvent[];
  relatedTopics: TopicCard[];
  relatedEntities: EntityCard[];
  topDocuments: DocumentCard[];
  mentionExcerpts: MentionExcerpt[];
  sources: EntitySource[];
  facts: EntityFact[];
};

export type TopicResponse = {
  topic: TopicDetail;
  relatedEntities: EntityCard[];
  topDocuments: DocumentCard[];
  mentionExcerpts: MentionExcerpt[];
};

export type DocumentResponse = {
  document: DocumentDetail;
  mentions: MentionExcerpt[];
  relatedEntities: EntityCard[];
  relatedDocuments: DocumentCard[];
};

// ---------------------------------------------------------------------------
// Open Questions — neutral-framing article surfacing tensions in the
// collection. Backed by the sql/27-29 map-reduce pipeline.
// ---------------------------------------------------------------------------

export type OpenQuestionsArticle = {
  text: string;
  model: string;
  generatedAt: string;
  sourceDocCount: number;
};

export type OpenQuestionsTopicCard = {
  slug: string;
  title: string;
  eyebrow?: string;
  summary: string;
  href: string;
  questionCount: number;
  sourceDocCount: number;
  tensionCounts: Record<string, number>;
};

export type OpenQuestionStatus =
  | "open"
  | "partially_resolved"
  | "resolved";

export type OpenQuestionThread = {
  id: string;
  question: string;
  summary: string | null;
  tensionType: string | null;
  supportingDocIds: string[];
  status: OpenQuestionStatus;
  resolutionText: string | null;
  resolutionCitationIds: string[];
};

export type CryptonymEntry = {
  cryptonym: string;
  meaning: string;
  status: "declassified" | "partial" | "unresolved";
  firstPublicSource: string | null;
  sourceCitationId: string | null;
  relatedEntityIds: string[];
  notes: string | null;
};

export type DealeyPlazaWitness = {
  witnessId: string;
  name: string;
  positionLat: number;
  positionLng: number;
  positionDescription: string;
  statementSummary: string;
  heardShots: number | null;
  /**
   * Free-text per-witness perception. Common values include
   * 'Texas School Book Depository', 'Grassy knoll / stockade fence',
   * 'Triple underpass area', 'Could not determine'.
   */
  shotOriginPerceived: string | null;
  wcTestimonyVolume: number | null;
  wcTestimonyPage: number | null;
  sourceNaids: string[];
  role: string | null;
};

export type DealeyPlazaResponse = {
  witnesses: DealeyPlazaWitness[];
  /**
   * Bounding box of all witness positions, used by the SVG renderer
   * to normalize lat/lng into viewBox coordinates.
   */
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
};

export type OpenQuestionsIndexResponse = {
  global: OpenQuestionsArticle | null;
  topics: OpenQuestionsTopicCard[];
};

export type EditorialFootnote = {
  id: string;
  tag: string;
  title: string;
  body: string;
  sourceCitation: string;
};

export type OpenQuestionsTopicResponse = {
  slug: string;
  title: string;
  eyebrow?: string;
  topicHref: string;
  article: OpenQuestionsArticle | null;
  questionCount: number;
  threads: OpenQuestionThread[];
  editorialFootnotes: EditorialFootnote[];
  cryptonyms: CryptonymEntry[];
};

// ---------------------------------------------------------------------------
// Case-wide timeline — backed by sql/22 (jfk_curated.timeline_events).
// Different from the entity-specific TimelineEvent above (which is the
// Oswald chronology embedded in the entity response).
// ---------------------------------------------------------------------------

export type CaseTimelineCategory =
  | "biographical"
  | "operational"
  | "investigation"
  | "release"
  | "death";

export type TimelineDocumentLink = {
  documentId: string;
  title: string | null;
  note: string | null;
};

export type CaseTimelineEvent = {
  id: string;
  date: string;
  timeLocal: string | null;
  title: string;
  description: string;
  category: CaseTimelineCategory;
  relatedEntityIds: string[];
  relatedTopicIds: string[];
  sourceExternal: string[];
  documentLinks: TimelineDocumentLink[];
  importance: number;
};

export type CaseTimelineIndex = {
  events: CaseTimelineEvent[];
  countsByCategory: Array<{
    category: CaseTimelineCategory;
    count: number;
  }>;
  countsByDecade: Array<{ decade: string; count: number }>;
};

// ---------------------------------------------------------------------------
// Bibliography — backed by sql/23 (jfk_curated.citation_registry).
// ---------------------------------------------------------------------------

export type CitationType =
  | "WC"
  | "HSCA"
  | "ARRB"
  | "CHURCH"
  | "REPORT"
  | "NARA"
  | "NAID"
  | "BOOK"
  | "JOURNAL"
  | "NEWS";

export type CitationEntry = {
  id: string;
  type: CitationType;
  bluebook: string;
  chicago: string;
  apa: string;
  url: string | null;
  author: string | null;
  title: string;
  publisher: string | null;
  year: number | null;
};

export type BibliographyIndex = {
  citations: CitationEntry[];
  countsByType: Array<{ type: CitationType; count: number }>;
};

// ---------------------------------------------------------------------------
// Established Facts — symmetric counterweight to Open Questions. Backed by
// sql/22a (jfk_curated.established_facts).
// ---------------------------------------------------------------------------

export type EstablishedFactConfidence =
  | "Settled"
  | "Well-supported"
  | "Contested";

export type EstablishedFactCategory =
  | "ballistic"
  | "witness"
  | "medical"
  | "chronology"
  | "documentary"
  | "operational"
  | "legal";

export type EstablishedFact = {
  id: string;
  topicId: string;
  topicTitle: string | null;
  topicHref: string;
  claim: string;
  longForm: string;
  supportingNaids: string[];
  supportingCitations: string[];
  category: EstablishedFactCategory;
  confidence: EstablishedFactConfidence;
};

export type EstablishedFactsIndex = {
  facts: EstablishedFact[];
  countsByConfidence: Array<{
    confidence: EstablishedFactConfidence;
    count: number;
  }>;
  countsByTopic: Array<{
    topicId: string;
    topicTitle: string | null;
    count: number;
  }>;
};

// ---------------------------------------------------------------------------
// Physical evidence — catalog of ballistic, firearm, photographic, medical,
// documentary, clothing, and environmental items from the case. Backed by
// sql/17 (jfk_curated.physical_evidence).
// ---------------------------------------------------------------------------

export type PhysicalEvidenceCategory =
  | "ballistic"
  | "firearm"
  | "photographic"
  | "medical"
  | "documentary"
  | "clothing"
  | "environmental";

export type EvidenceChainStep = {
  stepOrder: number;
  date: string | null;
  custodian: string;
  action: string;
};

export type EvidenceWcTestimonyRef = {
  volume: number;
  witness: string;
  page: number;
};

export type PhysicalEvidenceCard = {
  id: string;
  category: PhysicalEvidenceCategory;
  shortName: string;
  href: string;
  shortDescription: string;
  imageUrl: string | null;
  imageCredit: string | null;
  /** Descriptive alt text for imageUrl. Required for any image we render. */
  imageAlt: string | null;
};

export type PhysicalEvidenceDetail = PhysicalEvidenceCard & {
  longDescription: string;
  chainOfCustody: EvidenceChainStep[];
  referencedNaids: string[];
  referencedWcTestimony: EvidenceWcTestimonyRef[];
  relatedEntities: EntityCard[];
  /** URL of an authoritative copy hosted by NARA / LoC / a museum. */
  canonicalCopyUrl: string | null;
  canonicalCopyHost: string | null;
};

export type PhysicalEvidenceIndex = {
  items: PhysicalEvidenceCard[];
  categories: Array<{ category: PhysicalEvidenceCategory; count: number }>;
};

// ---------------------------------------------------------------------------
// Admin — redaction review queue.
// ---------------------------------------------------------------------------

export type RedactionReviewStatus =
  | "unreviewed"
  | "confirmed"
  | "rejected"
  | "needs_split"
  | "auto_confirmed";

export type RedactionQueueItem = {
  documentId: string;
  title: string | null;
  agency: string | null;
  releaseSet: string | null;
  numPages: number | null;
  totalDetections: number;
  unreviewedCount: number;
  confirmedCount: number;
  rejectedCount: number;
  firstPage: number;
  lastPage: number;
  meanConfidence: number | null;
  maxAreaPct: number | null;
  detectionMethod: string | null;
  reviewPriority: number;
};

export type RedactionQueueResponse = {
  items: RedactionQueueItem[];
  totalDocs: number;
  totalUnreviewed: number;
};

export type RedactionDetection = {
  redactionId: string;
  pageNum: number;
  bboxX1: number;
  bboxY1: number;
  bboxX2: number;
  bboxY2: number;
  areaPct: number | null;
  confidence: number | null;
  detectionMethod: string | null;
  reviewStatus: RedactionReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewerNotes: string | null;
};

export type RedactionDocDetail = {
  documentId: string;
  title: string | null;
  agency: string | null;
  releaseSet: string | null;
  numPages: number | null;
  totalDetections: number;
  unreviewedCount: number;
  detections: RedactionDetection[];
};

export type RedactionActionType =
  | "confirm"
  | "reject"
  | "needs_split"
  | "confirm_all";

export type RedactionAction = {
  type: RedactionActionType;
  redactionIds?: string[];  // required for per-detection actions; omitted for confirm_all
  notes?: string;
};

