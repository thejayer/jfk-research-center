export const SITE_NAME = "JFK Research Center";

export const PUBLIC_ROUTE_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=1800";

export const RECORD_ID_RE = /^[a-z0-9-]{1,120}$/i;

/** localStorage key used to persist saved research items; string key. */
export const storageKey = "jfkrc-saved-research";
/** Event name emitted after saved research changes; string CustomEvent name. */
export const changeEvent = "jfkrc:saved-research-changed";
/** Maximum saved research items retained; overflow drops oldest items. */
export const maxItems = 80;

/** Human-readable saved research labels; readonly record keys: document, evidence, entity, topic, timeline, question. */
export const typeLabels = {
  document: "Document",
  evidence: "Evidence",
  entity: "Entity",
  topic: "Topic",
  timeline: "Timeline",
  question: "Question",
} as const;

export const historyStorageKey = "jfkrc-research-history";
export const historyChangeEvent = "jfkrc:research-history-changed";
export const historyMaxItems = 24;

export const SEARCH_GROUPS = [
  "results",
  "entities",
  "topics",
  "timeline",
  "questions",
] as const;

export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export function isSearchGroup(value: unknown): value is SearchGroup {
  return (
    typeof value === "string" &&
    (SEARCH_GROUPS as readonly string[]).includes(value)
  );
}

export const DEFAULT_MUZZLE_VELOCITY_FPS = 2000;

export type TrajectorySourceReference = {
  id: string;
  label: string;
  kind: "record" | "film" | "model" | "assumption";
  note: string;
  href?: string;
};

export type TrajectoryFrameMark = {
  id: string;
  label: string;
  frame: number;
  timeSeconds: number;
  summary: string;
  target: {
    x: number;
    y: number;
    z: number;
  };
  uncertaintyDegrees: number;
  sourceIds: readonly string[];
};

export const TRAJECTORY_SOURCE_REFERENCES: readonly TrajectorySourceReference[] = [
  {
    id: "wc-report-1964",
    label: "Warren Commission report",
    kind: "record",
    href: "/document/wc-report-1964",
    note: "Primary report page used here as a stable entry point for Commission-era timing, exhibit, and scene references.",
  },
  {
    id: "zapruder-film",
    label: "Zapruder film evidence item",
    kind: "film",
    href: "/evidence/zapruder-film",
    note: "Visual timing reference for frame-labeled comparison points. This sandbox uses frame markers as navigation aids, not as forensic conclusions.",
  },
  {
    id: "dealey-plaza-topic",
    label: "Dealey Plaza topic dossier",
    kind: "record",
    href: "/topic/dealey-plaza",
    note: "Topic context for the plaza geography, witness map, and source records connected to the scene.",
  },
  {
    id: "coordinate-frame",
    label: "Plaza-relative coordinate frame",
    kind: "model",
    note: "Approximate local feet with +X east/right, +Y elevation, and +Z north/forward. Coordinates are current model inputs, not survey-grade measurements.",
  },
];

export const TRAJECTORY_FRAME_MARKS: readonly TrajectoryFrameMark[] = [
  {
    id: "z210",
    label: "Approach window",
    frame: 210,
    timeSeconds: 0,
    summary:
      "Representative pre-impact marker for comparing line geometry before the main impact frames.",
    target: { x: 38, y: 5, z: -50 },
    uncertaintyDegrees: 3.6,
    sourceIds: ["zapruder-film", "dealey-plaza-topic", "coordinate-frame"],
  },
  {
    id: "z225",
    label: "Reaction window",
    frame: 225,
    timeSeconds: 0.82,
    summary:
      "Approximate timing checkpoint after the limousine has moved farther down Elm Street.",
    target: { x: 46, y: 5, z: -58 },
    uncertaintyDegrees: 3.1,
    sourceIds: ["zapruder-film", "wc-report-1964", "coordinate-frame"],
  },
  {
    id: "z313",
    label: "Head-shot frame",
    frame: 313,
    timeSeconds: 5.64,
    summary:
      "Common frame reference for trajectory comparisons. The coordinate point remains schematic and adjustable.",
    target: { x: 58, y: 7, z: -70 },
    uncertaintyDegrees: 4.4,
    sourceIds: [
      "zapruder-film",
      "wc-report-1964",
      "dealey-plaza-topic",
      "coordinate-frame",
    ],
  },
];

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
