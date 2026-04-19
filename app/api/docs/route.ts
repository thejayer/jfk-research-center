import { type NextRequest } from "next/server";
import { preflight } from "@/lib/api-v1";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const base = `${origin}/api/v1`;
  return new Response(renderHtml(base, origin), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

type Endpoint = {
  method: "GET";
  path: string;
  summary: string;
  params?: Array<{ name: string; note: string }>;
  exampleUrl: (base: string) => string;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/documents",
    summary: "List / search documents",
    params: [
      { name: "q", note: "full-text query (title + description + OCR)" },
      { name: "topic", note: "repeatable, topic slug" },
      { name: "entity", note: "repeatable, entity id" },
      { name: "agency", note: "repeatable, agency name" },
      { name: "confidence", note: "repeatable: high|medium|low" },
      { name: "yearFrom", note: "inclusive start year (YYYY)" },
      { name: "yearTo", note: "inclusive end year (YYYY)" },
      { name: "limit", note: "1–200 (default 50)" },
    ],
    exampleUrl: (b) =>
      `${b}/documents?q=mexico+city&topic=mexico-city&yearFrom=1963&yearTo=1964&limit=10`,
  },
  {
    method: "GET",
    path: "/documents/{naid}",
    summary: "Fetch a single document by NARA record id (NAID).",
    exampleUrl: (b) => `${b}/documents/104-10535-10001`,
  },
  {
    method: "GET",
    path: "/entities",
    summary: "List curated entities (people, orgs, places, concepts).",
    exampleUrl: (b) => `${b}/entities`,
  },
  {
    method: "GET",
    path: "/entities/{id}",
    summary: "Fetch a single entity by slug.",
    exampleUrl: (b) => `${b}/entities/oswald`,
  },
  {
    method: "GET",
    path: "/topics",
    summary: "List the curated topic catalog.",
    exampleUrl: (b) => `${b}/topics`,
  },
  {
    method: "GET",
    path: "/topics/{slug}",
    summary: "Fetch a single topic by slug.",
    exampleUrl: (b) => `${b}/topics/warren-commission`,
  },
  {
    method: "GET",
    path: "/timeline",
    summary: "Case-wide timeline events, filterable by date range and category.",
    params: [
      { name: "from", note: "inclusive ISO date (YYYY-MM-DD)" },
      { name: "to", note: "inclusive ISO date (YYYY-MM-DD)" },
      {
        name: "category",
        note: "repeatable: biographical|operational|investigation|release|death",
      },
    ],
    exampleUrl: (b) =>
      `${b}/timeline?from=1963-11-22&to=1963-11-25&category=investigation`,
  },
  {
    method: "GET",
    path: "/search/semantic",
    summary:
      "Vector search over OCR chunks (Vertex text-embedding-005, cosine). Returns top-K chunks with similarity scores in [0,1]. Hits Vertex per call — expect single-digit-cents cost and ~1 s latency.",
    params: [
      { name: "q", note: "natural-language query (required)" },
      { name: "limit", note: "1–50 (default 20)" },
    ],
    exampleUrl: (b) =>
      `${b}/search/semantic?q=${encodeURIComponent("Oswald Mexico City Cuban consulate")}&limit=5`,
  },
];

function renderHtml(base: string, origin: string): string {
  const rows = ENDPOINTS.map(
    (e) => `
    <article class="endpoint">
      <header>
        <span class="method">${e.method}</span>
        <code class="path">${esc(e.path)}</code>
      </header>
      <p>${esc(e.summary)}</p>
      ${
        e.params && e.params.length > 0
          ? `<dl>${e.params.map((p) => `<dt><code>${esc(p.name)}</code></dt><dd>${esc(p.note)}</dd>`).join("")}</dl>`
          : ""
      }
      <div class="example">
        <div class="example-label">Example</div>
        <code class="example-url">GET ${esc(e.exampleUrl(base))}</code>
        <a class="example-link" href="${esc(e.exampleUrl(base))}" target="_blank" rel="noopener">try →</a>
      </div>
    </article>
  `,
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>JFK Research Center — API v1</title>
  <style>
    :root {
      --bg: #fbf8f4;
      --surface: #ffffff;
      --text: #1a1815;
      --text-muted: #6c655d;
      --border: #e7e1d9;
      --border-strong: #cfc6ba;
      --accent: #6d2f2f;
      --accent-soft: #e7d7d3;
      --radius: 8px;
      --font-serif: "Source Serif 4", Georgia, serif;
      --font-sans: "Inter", system-ui, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #141210;
        --surface: #1d1a17;
        --text: #e8e3dc;
        --text-muted: #8a8378;
        --border: #2a2623;
        --border-strong: #3a342f;
        --accent: #c68b84;
        --accent-soft: #3a2a29;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font-sans);
      background: var(--bg);
      color: var(--text);
      line-height: 1.55;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 24px 96px;
    }
    h1 {
      font-family: var(--font-serif);
      font-size: 2.2rem;
      letter-spacing: -0.02em;
      margin: 0 0 6px;
    }
    .eyebrow {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--text-muted);
    }
    .lede {
      max-width: 64ch;
      color: var(--text);
      margin: 14px 0 36px;
    }
    .links {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 40px;
    }
    .links a {
      display: inline-block;
      padding: 6px 14px;
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      color: var(--text);
      text-decoration: none;
      font-size: 0.88rem;
    }
    .links a:hover {
      background: var(--surface);
    }
    .endpoint {
      padding: 22px 0;
      border-top: 1px solid var(--border);
    }
    .endpoint header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .method {
      font-family: var(--font-mono);
      font-size: 0.76rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      background: var(--accent-soft);
      color: var(--accent);
    }
    .path {
      font-family: var(--font-mono);
      font-size: 0.98rem;
      color: var(--text);
    }
    .endpoint p { margin: 4px 0 12px; max-width: 60ch; }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      column-gap: 14px;
      row-gap: 4px;
      margin: 6px 0 14px;
      font-size: 0.88rem;
    }
    dt {
      font-family: var(--font-mono);
      color: var(--text);
    }
    dd {
      margin: 0;
      color: var(--text-muted);
    }
    .example {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 10px;
      padding: 12px 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 0.84rem;
    }
    .example-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
    }
    .example-url {
      font-family: var(--font-mono);
      word-break: break-all;
      flex: 1 1 auto;
      min-width: 0;
    }
    .example-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 500;
    }
    .example-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="eyebrow">JFK Research Center</div>
    <h1>API v1</h1>
    <p class="lede">
      Read-only HTTP endpoints over the curated JFK Assassination Records
      collection. All endpoints return JSON, are CORS-open, and require no
      authentication. Rate limits and API keys are coming in a future
      release; until then please be a considerate neighbor.
    </p>
    <div class="links">
      <a href="${esc(origin)}/api/v1/openapi.json">OpenAPI spec (JSON)</a>
      <a href="${esc(origin)}/">Back to site</a>
    </div>
    ${rows}
  </div>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
