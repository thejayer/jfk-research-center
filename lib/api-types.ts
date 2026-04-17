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
  source: "title" | "description" | "ocr" | "authority";
  pageLabel?: string | null;
};

export type SearchResult =
  | { kind: "document"; document: DocumentCard; mentionCount: number; confidence: ConfidenceLevel; }
  | { kind: "mention"; mention: MentionExcerpt };

export type SearchFilters = {
  years: string[];
  agencies: string[];
  topics: string[];
  entities: string[];
  confidence: ConfidenceLevel[];
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
};

export type SearchResponse = {
  query: string;
  mode: "document" | "mention";
  total: number;
  filters: SearchFilters;
  appliedFilters?: Partial<SearchFilters>;
  results: SearchResult[];
};

export type EntityResponse = {
  entity: EntityDetail;
  timeline: TimelineEvent[];
  relatedTopics: TopicCard[];
  relatedEntities: EntityCard[];
  topDocuments: DocumentCard[];
  mentionExcerpts: MentionExcerpt[];
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
