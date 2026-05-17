import {
  publicApiDefaultAnonymousLimit,
  publicApiSearchAnonymousLimit,
  publicApiSemanticKeyedLimit,
} from "./constants";

export {
  publicApiDefaultAnonymousLimit,
  publicApiSearchAnonymousLimit,
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
    currentAccess: "anonymous",
    targetAccess: "anonymous_metered",
    costClass: "warehouse",
    cacheSeconds: 300,
    anonymousLimit: publicApiSearchAnonymousLimit,
    keyedLimit: publicApiDefaultAnonymousLimit,
    killSwitch: "JFK_API_DISABLE_DOCUMENT_SEARCH",
    notes: "Query parameters can create expensive BigQuery scans; keep anonymous use low and allow higher keyed quotas later.",
  },
  {
    method: "GET",
    path: "/api/v1/documents/{naid}",
    summary: "Single document lookup by NAID or canonical document id.",
    currentAccess: "anonymous",
    targetAccess: "anonymous",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: publicApiDefaultAnonymousLimit,
    keyedLimit: null,
    killSwitch: null,
    notes: "Cacheable record lookup with bounded input.",
  },
  {
    method: "GET",
    path: "/api/v1/entities",
    summary: "Curated entity catalog.",
    currentAccess: "anonymous",
    targetAccess: "anonymous",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: publicApiDefaultAnonymousLimit,
    keyedLimit: null,
    killSwitch: null,
    notes: "Catalog list changes slowly and is safe for anonymous clients.",
  },
  {
    method: "GET",
    path: "/api/v1/entities/{id}",
    summary: "Single entity detail lookup.",
    currentAccess: "anonymous",
    targetAccess: "anonymous",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: publicApiDefaultAnonymousLimit,
    keyedLimit: null,
    killSwitch: null,
    notes: "Cacheable lookup with bounded slug input.",
  },
  {
    method: "GET",
    path: "/api/v1/topics",
    summary: "Curated topic catalog.",
    currentAccess: "anonymous",
    targetAccess: "anonymous",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: publicApiDefaultAnonymousLimit,
    keyedLimit: null,
    killSwitch: null,
    notes: "Small catalog surface suitable for anonymous access.",
  },
  {
    method: "GET",
    path: "/api/v1/topics/{slug}",
    summary: "Single topic detail lookup.",
    currentAccess: "anonymous",
    targetAccess: "anonymous",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: publicApiDefaultAnonymousLimit,
    keyedLimit: null,
    killSwitch: null,
    notes: "Cacheable lookup with bounded slug input.",
  },
  {
    method: "GET",
    path: "/api/v1/timeline",
    summary: "Case-wide timeline with optional date/category filters.",
    currentAccess: "anonymous",
    targetAccess: "anonymous",
    costClass: "warehouse",
    cacheSeconds: 600,
    anonymousLimit: publicApiDefaultAnonymousLimit,
    keyedLimit: null,
    killSwitch: null,
    notes: "The route fetches and filters a bounded timeline index.",
  },
  {
    method: "GET",
    path: "/api/v1/search/semantic",
    summary: "Vector search over OCR chunks using Vertex embeddings.",
    currentAccess: "anonymous",
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
