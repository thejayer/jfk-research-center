export const SITE_NAME = "JFK Research Center";

export const PUBLIC_ROUTE_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=1800";

export const RECORD_ID_RE = /^[a-z0-9-]{1,120}$/i;

export const DEFAULT_MUZZLE_VELOCITY_FPS = 2000;

export const FEATURED_ENTITY_SLUGS = [
  "oswald",
  "ruby",
  "cia",
  "fbi",
  "warren-commission",
  "hsca",
] as const;

export const FEATURED_TOPIC_SLUGS = [
  "warren-commission",
  "hsca",
  "mexico-city",
  "cia",
  "fbi",
] as const;

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const AGENCIES = [
  "FBI",
  "CIA",
  "Warren Commission",
  "HSCA",
  "ARRB",
  "Secret Service",
  "Department of State",
  "Department of Defense",
];

export const DOCUMENT_TYPES = [
  "Textual Record",
  "Memorandum",
  "Report",
  "Testimony",
  "Correspondence",
  "Photograph",
];

export type ResearchPath = {
  slug: string;
  title: string;
  summary: string;
  href: string;
  startHref: string;
  steps: Array<{
    label: string;
    href: string;
    detail: string;
  }>;
};

export const RESEARCH_PATHS: ResearchPath[] = [
  {
    slug: "oswald-paper-trail",
    title: "Oswald paper trail",
    summary:
      "Follow Oswald from entity profile into timeline context, mention search, and core documents.",
    href: "/research-paths#oswald-paper-trail",
    startHref: "/entity/oswald",
    steps: [
      {
        label: "Open entity dossier",
        href: "/entity/oswald",
        detail: "Biography, aliases, top documents, and excerpts.",
      },
      {
        label: "Search mentions",
        href: "/search?q=Oswald&mode=mention",
        detail: "OCR passages and description hits across the archive.",
      },
      {
        label: "Read the chronology",
        href: "/timeline?view=list&category=biographical",
        detail: "Biographical events in the case-wide timeline.",
      },
    ],
  },
  {
    slug: "ruby-transfer",
    title: "Ruby and the transfer",
    summary:
      "Compare Ruby's profile against the Dallas weekend timeline and related source records.",
    href: "/research-paths#ruby-transfer",
    startHref: "/entity/ruby",
    steps: [
      {
        label: "Open Ruby profile",
        href: "/entity/ruby",
        detail: "Connected people, documents, and passages.",
      },
      {
        label: "Read Dallas sequence",
        href: "/timeline?view=dallas",
        detail: "Hour-by-hour sequence through Oswald's transfer.",
      },
      {
        label: "Search Ruby records",
        href: "/search?q=Ruby&mode=document",
        detail: "Document matches and OCR signals.",
      },
    ],
  },
  {
    slug: "fbi-files",
    title: "FBI files",
    summary:
      "Start with the FBI topic lane, then widen into agency-scoped records and open questions.",
    href: "/research-paths#fbi-files",
    startHref: "/topic/fbi",
    steps: [
      {
        label: "Open topic dossier",
        href: "/topic/fbi",
        detail: "Curated records and analysis for FBI material.",
      },
      {
        label: "Search FBI records",
        href: "/search?q=FBI&mode=document",
        detail: "Document-level matches with source cues.",
      },
      {
        label: "Review open questions",
        href: "/open-questions",
        detail: "Unresolved tensions surfaced from the collection.",
      },
    ],
  },
  {
    slug: "warren-commission",
    title: "Warren Commission record",
    summary:
      "Move from the Commission report into bibliography, open questions, and supporting documents.",
    href: "/research-paths#warren-commission",
    startHref: "/document/wc-report-1964",
    steps: [
      {
        label: "Read the report",
        href: "/document/wc-report-1964",
        detail: "Primary record page with metadata, OCR, and related context.",
      },
      {
        label: "Open topic lane",
        href: "/topic/warren-commission",
        detail: "Topic overview and important records.",
      },
      {
        label: "Check bibliography",
        href: "/bibliography#wc-report",
        detail: "Citation formats and source registry.",
      },
    ],
  },
  {
    slug: "ce-399-custody",
    title: "CE 399 custody path",
    summary:
      "Follow the evidence item through custody steps, NARA references, and linked entities.",
    href: "/research-paths#ce-399-custody",
    startHref: "/evidence/ce-399",
    steps: [
      {
        label: "Open evidence item",
        href: "/evidence/ce-399",
        detail: "Description, custody trail, and record references.",
      },
      {
        label: "Compare evidence",
        href: "/evidence#comparison",
        detail: "Category, custody depth, record references, and item type.",
      },
      {
        label: "Search CE 399",
        href: "/search?q=CE%20399&mode=document",
        detail: "Document matches for the exhibit label.",
      },
    ],
  },
];
