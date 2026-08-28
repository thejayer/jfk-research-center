import {
  publicApiDefaultAnonymousLimit,
  publicApiDefaultKeyedLimit,
  publicApiSemanticKeyedLimit,
} from "./constants";

export {
  publicApiDefaultAnonymousLimit,
  publicApiDefaultKeyedLimit,
  publicApiSemanticKeyedLimit,
} from "./constants";

export type PublicApiAccessMode =
  | "anonymous"
  | "anonymous_metered"
  | "key_required";

export type PublicApiCostClass = "static" | "warehouse" | "vertex";

export type PublicApiRateWindow = {
  requests: number;
  windowSeconds: number;
};

export type PublicApiEndpointPolicy = {
  method: "GET";
  path: string;
  summary: string;
  currentAccess: PublicApiAccessMode;
  targetAccess: PublicApiAccessMode;
  costClass: PublicApiCostClass;
  cacheSeconds: number;
  anonymousLimit: PublicApiRateWindow | null;
  keyedLimit: PublicApiRateWindow | null;
  killSwitch: string | null;
  notes: string;
};

export const publicApiEndpointPolicies: readonly PublicApiEndpointPolicy[] = [
  {
    method: "GET",
    path: "/api/v1/openapi.json",
    summary: "Machine-readable OpenAPI specification.",
    currentAccess: "anonymous",
    targetAccess: "anonymous",
    costClass: "static",
    cacheSeconds: 3600,
    anonymousLimit: publicApiDefaultAnonymousLimit,
    keyedLimit: null,
    killSwitch: null,
    notes: "Keep public so clients can discover the API contract.",
  },
  {
    method: "GET",
    path: "/api/v1/documents",
    summary: "Document search over metadata, filters, and OCR-backed matches.",
    currentAccess: "key_required",
    targetAccess: "key_required",
    costClass: "warehouse",
    cacheSeconds: 300,
    anonymousLimit: null,
    keyedLimit: publicApiDefaultKeyedLimit,
    killSwitch: "JFK_API_DISABLE_DOCUMENT_SEARCH",
    notes: "Query parameters can create expensive BigQuery scans; require a key and cap keyed callers.",
  },
  {
    method: "GET",
    path: "/api/v1/documents/{naid}",
    summary: "Single document lookup by NAID or canonical document id.",
    currentAccess: "key_required",
    targetAccess: "key_required",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: null,
    keyedLimit: publicApiDefaultKeyedLimit,
    killSwitch: null,
    notes: "Cacheable record lookup with bounded input; still hits BigQuery.",
  },
  {
    method: "GET",
    path: "/api/v1/entities",
    summary: "Curated entity catalog.",
    currentAccess: "key_required",
    targetAccess: "key_required",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: null,
    keyedLimit: publicApiDefaultKeyedLimit,
    killSwitch: null,
    notes: "Catalog list is small but warehouse-backed; require a key.",
  },
  {
    method: "GET",
    path: "/api/v1/entities/{id}",
    summary: "Single entity detail lookup.",
    currentAccess: "key_required",
    targetAccess: "key_required",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: null,
    keyedLimit: publicApiDefaultKeyedLimit,
    killSwitch: null,
    notes: "Cacheable lookup with bounded slug input; still hits BigQuery.",
  },
  {
    method: "GET",
    path: "/api/v1/topics",
    summary: "Curated topic catalog.",
    currentAccess: "key_required",
    targetAccess: "key_required",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: null,
    keyedLimit: publicApiDefaultKeyedLimit,
    killSwitch: null,
    notes: "Small catalog surface; require a key because it reads BigQuery.",
  },
  {
    method: "GET",
    path: "/api/v1/topics/{slug}",
    summary: "Single topic detail lookup.",
    currentAccess: "key_required",
    targetAccess: "key_required",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: null,
    keyedLimit: publicApiDefaultKeyedLimit,
    killSwitch: null,
    notes: "Cacheable lookup with bounded slug input; still hits BigQuery.",
  },
  {
    method: "GET",
    path: "/api/v1/timeline",
    summary: "Case-wide timeline with optional date/category filters.",
    currentAccess: "key_required",
    targetAccess: "key_required",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: null,
    keyedLimit: publicApiDefaultKeyedLimit,
    killSwitch: null,
    notes: "The route fetches and filters a bounded timeline index from BigQuery.",
  },
  {
    method: "GET",
    path: "/api/v1/search/semantic",
    summary: "Vector search over OCR chunks using Vertex embeddings.",
    currentAccess: "key_required",
    targetAccess: "key_required",
    costClass: "vertex",
    cacheSeconds: 60,
    anonymousLimit: null,
    keyedLimit: publicApiSemanticKeyedLimit,
    killSwitch: "JFK_API_DISABLE_SEMANTIC_SEARCH",
    notes: "This endpoint generates embeddings per novel query and should require keys before any public scale-up or /ask integration.",
  },
];

export function findPublicApiEndpointPolicy(
  method: string,
  pathname: string,
): PublicApiEndpointPolicy | null {
  const normalizedMethod = method.toUpperCase();
  return (
    publicApiEndpointPolicies.find(
      (policy) =>
        policy.method === normalizedMethod && pathPatternMatches(policy.path, pathname),
    ) ?? null
  );
}

function pathPatternMatches(pattern: string, pathname: string): boolean {
  if (pattern === pathname) return true;
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every(
    (part, index) => isPathParam(part) || part === pathParts[index],
  );
}

function isPathParam(part: string): boolean {
  return part.startsWith("{") && part.endsWith("}");
}
