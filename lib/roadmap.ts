/**
 * Hand-maintained roadmap surfaced at /about/roadmap. Lists shipped,
 * in-progress, and planned surfaces so users probing /ask, /compare,
 * /corrections and other not-yet-built routes see a deliberate signal
 * instead of a 404.
 *
 * Update this file when a new wave ships or a planned route lands.
 */

export type RoadmapStatus = "shipped" | "in_progress" | "planned";

export type RoadmapItem = {
  /** Path or external URL the item describes. */
  surface: string;
  /** Short human-readable label. */
  label: string;
  status: RoadmapStatus;
  /** Phase identifier from the gameplan (e.g. "Phase 5", "Hotfix cycle"). */
  phase: string;
  /** One-sentence description of what the item does or will do. */
  description: string;
  /** Optional GitHub issue/PR URL. */
  trackingUrl?: string;
};

export const ROADMAP: RoadmapItem[] = [
  // ---- Phase 0–3: foundation, accuracy, and content surfaces (shipped) ----
  {
    surface: "/",
    label: "Home + scope banner",
    status: "shipped",
    phase: "Phase 0",
    description:
      "Curated landing page with the corpus scope disclosure and Featured Entities/Topics rails.",
  },
  {
    surface: "/search",
    label: "Search (document, mention, semantic)",
    status: "shipped",
    phase: "Phase 4 / 5-A",
    description:
      "Three-tab search across record metadata, OCR mentions, and Vertex semantic vectors.",
  },
  {
    surface: "/entity/[slug]",
    label: "Entity detail pages",
    status: "shipped",
    phase: "Phase 2-A",
    description:
      "Per-person/org pages with Quick Facts, timeline, related topics, top documents, and sources.",
  },
  {
    surface: "/topic/[slug]",
    label: "Topic detail pages",
    status: "shipped",
    phase: "Phase 2-B",
    description:
      "Per-topic AI summary + long-form analysis with inline citations, related entities, and document grid.",
  },
  {
    surface: "/document/[id]",
    label: "Document detail pages",
    status: "shipped",
    phase: "Phase 1",
    description:
      "Per-record metadata, OCR panel, release history strip, and per-chunk citation deep links.",
  },
  {
    surface: "/timeline",
    label: "Case timeline",
    status: "shipped",
    phase: "Phase 3-F (light)",
    description: "Vertical chronological case timeline; full zoomable D3 view planned.",
  },
  {
    surface: "/evidence",
    label: "Physical evidence catalog",
    status: "shipped",
    phase: "Phase 1-D",
    description: "Catalog of 33 ballistic, firearm, photographic, medical, and documentary items.",
  },
  {
    surface: "/open-questions",
    label: "Open Questions",
    status: "shipped",
    phase: "Phase 2-D",
    description:
      "Per-topic and global articles surfacing tensions in the corpus, generated via map-reduce.",
  },
  {
    surface: "/established-facts",
    label: "Established Facts",
    status: "shipped",
    phase: "Phase 2-C",
    description:
      "Symmetric counterweight to Open Questions: WC/HSCA/ARRB/Church-supported findings.",
  },
  {
    surface: "/releases",
    label: "Release history",
    status: "shipped",
    phase: "Phase 3-H",
    description: "Reverse-chron declassification milestones with per-release record counts.",
  },
  {
    surface: "/bibliography",
    label: "Bibliography",
    status: "shipped",
    phase: "Phase 3-I",
    description: "Allowlisted citations in Bluebook/Chicago/APA formats.",
  },
  {
    surface: "/graph",
    label: "Entity co-occurrence network",
    status: "shipped",
    phase: "Phase 5-C",
    description:
      "Force-directed network of entity-pair co-occurrence with year-range slider.",
  },
  {
    surface: "/api/v1/*",
    label: "Public API v1",
    status: "shipped",
    phase: "Phase 5-E",
    description:
      "Read-only, CORS-open endpoints for documents, entities, topics, timeline, and semantic search.",
  },

  // ---- Hotfix cycle (April 2026) ----
  {
    surface: "/about",
    label: "About hub + roadmap",
    status: "in_progress",
    phase: "Hotfix cycle",
    description: "About hub linking Methodology, Editorial policy, and this Roadmap.",
  },
  {
    surface: "/corrections",
    label: "Corrections workflow",
    status: "in_progress",
    phase: "Hotfix cycle",
    description: "Public form for flagging factual errors; admin triage view behind IAM.",
  },
  {
    surface: "/dealey-plaza",
    label: "Dealey Plaza interactive map",
    status: "in_progress",
    phase: "Hotfix cycle",
    description:
      "SVG schematic with witness pins, motorcade overlay, and toggleable shot-origin perceptions.",
  },

  // ---- Phase 5 deferred ----
  {
    surface: "/ask",
    label: "Grounded research chatbot (/ask)",
    status: "planned",
    phase: "Phase 5-D",
    description:
      "Hard-cited Q&A grounded in the corpus via Vertex AI. Highest-risk addition; gold-set eval and citation guardrails required first.",
  },
  {
    surface: "/compare",
    label: "Per-release redaction diff (/compare)",
    status: "planned",
    phase: "Phase 5-B",
    description:
      "Side-by-side visual diff of the same NAID across releases. Gated on per-release OCR ingest, not yet built.",
  },
  {
    surface: "BigQuery public dataset mirror",
    label: "Public dataset mirror",
    status: "planned",
    phase: "Phase 5-F",
    description:
      "Publish curated tables to bigquery-public-data:jfk_research_center.* once the public API has stabilized.",
  },
  {
    surface: "API keys + rate limits",
    label: "Public API key + rate limit layer",
    status: "planned",
    phase: "Phase 5-E follow-up",
    description:
      "Firestore-backed keys with per-key counters and a kill switch on Vertex-hit endpoints.",
  },
];
