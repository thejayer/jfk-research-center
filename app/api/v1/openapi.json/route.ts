import { type NextRequest } from "next/server";
import { jsonResponse, preflight } from "@/lib/api-v1";
import { denyUnauthorizedPublicApi } from "@/lib/public-api-enforcement";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/v1/openapi.json
 *
 * Machine-readable spec for the public v1 API. The `servers` entry is
 * derived from the request origin so whoever hosts the site gets a
 * working URL in their OpenAPI clients without a hardcoded domain.
 */
export async function GET(req: NextRequest) {
  const denied = await denyUnauthorizedPublicApi(req);
  if (denied) return denied;

  const origin = req.nextUrl.origin;
  return jsonResponse(buildSpec(`${origin}/api/v1`), { cacheSeconds: 3600 });
}

function buildSpec(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "JFK Research Center API",
      version: "1.0.0",
      description:
        "Read-only HTTP API for the curated JFK Assassination Records collection. Warehouse and Vertex endpoints require an API key (`Authorization: Bearer <key>` or `X-JFKRC-API-Key`). CORS remains open so browser clients can send those headers. `GET /api/v1/openapi.json` stays anonymous so the contract is readable without a key.",
      contact: {
        url: "https://github.com/thejayer/jfk-research-center",
      },
    },
    servers: [{ url: baseUrl }],
    security: [{ ApiKeyAuth: [] }, { ApiKeyHeader: [] }],
    paths: {
      "/documents": {
        get: {
          summary: "List / search documents",
          description:
            "Keyword-driven search over titles, descriptions, and ABBYY OCR chunks, with repeatable topic/entity/agency filters and an event-date range. Returns a SearchResponse with facet sidebar data.",
          parameters: [
            queryParam("q", "Full-text query. Substring LIKE over title, description, OCR."),
            queryParam("topic", "Repeatable topic slug (e.g. warren-commission)."),
            queryParam("entity", "Repeatable entity id (e.g. oswald)."),
            queryParam("agency", "Repeatable agency name (e.g. CIA)."),
            queryParam("confidence", "Repeatable: high|medium|low."),
            queryParam("yearFrom", "Inclusive start year (YYYY).", "integer"),
            queryParam("yearTo", "Inclusive end year (YYYY).", "integer"),
            queryParam("limit", "1..200, default 50.", "integer"),
          ],
          responses: {
            "200": { description: "SearchResponse", content: jsonContent() },
            ...keyedAuthErrorResponses(),
            "503": { description: "Endpoint temporarily disabled", content: errorContent() },
            "500": { description: "Warehouse error", content: errorContent() },
          },
        },
      },
      "/documents/{naid}": {
        get: {
          summary: "Fetch a single document by NAID",
          parameters: [pathParam("naid", "NARA record identifier")],
          responses: {
            "200": { description: "DocumentResponse", content: jsonContent() },
            ...keyedAuthErrorResponses(),
            "404": { description: "Not found", content: errorContent() },
          },
        },
      },
      "/entities": {
        get: {
          summary: "List curated entities",
          responses: {
            "200": { description: "{ entities: EntityCard[] }", content: jsonContent() },
            ...keyedAuthErrorResponses(),
          },
        },
      },
      "/entities/{id}": {
        get: {
          summary: "Fetch a single entity by slug",
          parameters: [pathParam("id", "Entity slug, e.g. oswald")],
          responses: {
            "200": { description: "EntityResponse", content: jsonContent() },
            ...keyedAuthErrorResponses(),
            "404": { description: "Not found", content: errorContent() },
          },
        },
      },
      "/topics": {
        get: {
          summary: "List the curated topic catalog",
          responses: {
            "200": { description: "{ topics: TopicCard[] }", content: jsonContent() },
            ...keyedAuthErrorResponses(),
          },
        },
      },
      "/topics/{slug}": {
        get: {
          summary: "Fetch a single topic by slug",
          parameters: [pathParam("slug", "Topic slug, e.g. mexico-city")],
          responses: {
            "200": { description: "TopicResponse", content: jsonContent() },
            ...keyedAuthErrorResponses(),
            "404": { description: "Not found", content: errorContent() },
          },
        },
      },
      "/timeline": {
        get: {
          summary: "Case-wide timeline events",
          parameters: [
            queryParam("from", "Inclusive ISO date (YYYY-MM-DD)."),
            queryParam("to", "Inclusive ISO date (YYYY-MM-DD)."),
            queryParam(
              "category",
              "Repeatable: biographical|operational|investigation|release|death",
            ),
          ],
          responses: {
            "200": { description: "CaseTimelineIndex", content: jsonContent() },
            ...keyedAuthErrorResponses(),
          },
        },
      },
      "/search/semantic": {
        get: {
          summary: "Vector search over OCR chunks",
          description:
            "Requires an API key. Embeds `q` with Vertex text-embedding-005 (RETRIEVAL_QUERY) and runs cosine VECTOR_SEARCH over the 112k chunk embeddings. Returns up to `limit` MentionExcerpt-shaped results with a `score` field in [0,1] (higher = more relevant).",
          parameters: [
            queryParam("q", "Natural-language query (required).", "string", true),
            queryParam("limit", "1..50, default 20.", "integer"),
          ],
          responses: {
            "200": { description: "SearchResponse", content: jsonContent() },
            "400": { description: "Missing q", content: errorContent() },
            ...keyedAuthErrorResponses(),
            "503": { description: "Endpoint temporarily disabled", content: errorContent() },
            "500": { description: "Vertex / warehouse error", content: errorContent() },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          description: "Preferred API key format: `Authorization: Bearer <key>`.",
        },
        ApiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "X-JFKRC-API-Key",
          description: "Script-friendly API key header for clients that cannot set Authorization.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "string" } },
        },
      },
    },
  };
}

function pathParam(name: string, description: string) {
  return {
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
    description,
  };
}

function queryParam(
  name: string,
  description: string,
  type: "string" | "integer" = "string",
  required = false,
) {
  return {
    name,
    in: "query",
    required,
    schema: { type },
    description,
  };
}

function jsonContent() {
  return { "application/json": { schema: { type: "object" } } };
}

function errorContent() {
  return {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  };
}

function keyedAuthErrorResponses() {
  return {
    "401": { description: "API key required", content: errorContent() },
    "403": { description: "API key not allowed", content: errorContent() },
    "429": { description: "Rate limit exceeded", content: errorContent() },
  };
}
