import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const warehouse = vi.hoisted(() => ({
  fetchSearch: vi.fn(),
  fetchDocument: vi.fn(),
  fetchAllEntities: vi.fn(),
  fetchEntity: vi.fn(),
  fetchAllTopics: vi.fn(),
  fetchTopic: vi.fn(),
  fetchCaseTimeline: vi.fn(),
}));

vi.mock("@/lib/warehouse", () => warehouse);

import { GET as getDocuments } from "@/app/api/v1/documents/route";
import { GET as getDocument } from "@/app/api/v1/documents/[naid]/route";
import { GET as getEntities } from "@/app/api/v1/entities/route";
import { GET as getEntity } from "@/app/api/v1/entities/[id]/route";
import { GET as getTopics } from "@/app/api/v1/topics/route";
import { GET as getTopic } from "@/app/api/v1/topics/[slug]/route";
import { GET as getTimeline } from "@/app/api/v1/timeline/route";
import { GET as getSemantic } from "@/app/api/v1/search/semantic/route";
import { GET as getOpenApi } from "@/app/api/v1/openapi.json/route";

const GOOD_KEY = "test-researcher-key";

const WAREHOUSE_CASES: Array<{
  name: string;
  path: string;
  call: (req: NextRequest) => Promise<Response>;
}> = [
  {
    name: "documents list",
    path: "/api/v1/documents?q=oswald",
    call: (req) => getDocuments(req),
  },
  {
    name: "document by id",
    path: "/api/v1/documents/104-10535-10001",
    call: (req) =>
      getDocument(req, {
        params: Promise.resolve({ naid: "104-10535-10001" }),
      }),
  },
  {
    name: "entities list",
    path: "/api/v1/entities",
    call: (req) => getEntities(req),
  },
  {
    name: "entity by id",
    path: "/api/v1/entities/oswald",
    call: (req) =>
      getEntity(req, { params: Promise.resolve({ id: "oswald" }) }),
  },
  {
    name: "topics list",
    path: "/api/v1/topics",
    call: (req) => getTopics(req),
  },
  {
    name: "topic by slug",
    path: "/api/v1/topics/mexico-city",
    call: (req) =>
      getTopic(req, { params: Promise.resolve({ slug: "mexico-city" }) }),
  },
  {
    name: "timeline",
    path: "/api/v1/timeline",
    call: (req) => getTimeline(req),
  },
  {
    name: "semantic search",
    path: "/api/v1/search/semantic?q=oswald",
    call: (req) => getSemantic(req),
  },
];

describe("public /api/v1 route enforcement", () => {
  beforeEach(() => {
    process.env.JFK_API_KEYS = GOOD_KEY;
    delete process.env.JFK_API_DISABLE_SEMANTIC_SEARCH;
    warehouse.fetchSearch.mockResolvedValue({
      documents: [],
      mentions: [],
      total: 0,
    });
    warehouse.fetchDocument.mockResolvedValue({ id: "104-10535-10001" });
    warehouse.fetchAllEntities.mockResolvedValue([]);
    warehouse.fetchEntity.mockResolvedValue({ id: "oswald" });
    warehouse.fetchAllTopics.mockResolvedValue([]);
    warehouse.fetchTopic.mockResolvedValue({ slug: "mexico-city" });
    warehouse.fetchCaseTimeline.mockResolvedValue({
      events: [],
      countsByCategory: {},
      countsByDecade: {},
    });
  });

  afterEach(() => {
    delete process.env.JFK_API_KEYS;
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated warehouse calls", async () => {
    for (const route of WAREHOUSE_CASES) {
      const response = await route.call(request(route.path));
      expect(response.status, route.name).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: "api key required",
      });
    }
    expect(warehouse.fetchSearch).not.toHaveBeenCalled();
    expect(warehouse.fetchDocument).not.toHaveBeenCalled();
    expect(warehouse.fetchAllEntities).not.toHaveBeenCalled();
  });

  it("returns 403 for a bad API key", async () => {
    for (const route of WAREHOUSE_CASES) {
      const response = await route.call(
        request(route.path, { authorization: "Bearer not-a-real-key" }),
      );
      expect(response.status, route.name).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "api key not allowed",
      });
    }
  });

  it("returns 200 for a good API key without hitting a real warehouse", async () => {
    for (const route of WAREHOUSE_CASES) {
      const response = await route.call(
        request(route.path, { authorization: `Bearer ${GOOD_KEY}` }),
      );
      expect(response.status, route.name).toBe(200);
    }

    expect(warehouse.fetchSearch).toHaveBeenCalled();
    expect(warehouse.fetchDocument).toHaveBeenCalled();
    expect(warehouse.fetchAllEntities).toHaveBeenCalled();
    expect(warehouse.fetchEntity).toHaveBeenCalled();
    expect(warehouse.fetchAllTopics).toHaveBeenCalled();
    expect(warehouse.fetchTopic).toHaveBeenCalled();
    expect(warehouse.fetchCaseTimeline).toHaveBeenCalled();
  });

  it("serves OpenAPI without a key and documents the key requirement", async () => {
    const response = await getOpenApi(request("/api/v1/openapi.json"));
    expect(response.status).toBe(200);
    const spec = (await response.json()) as {
      info: { description: string };
      security: unknown;
      paths: Record<string, { get: { responses: Record<string, unknown> } }>;
    };

    expect(spec.info.description).toMatch(/require an API key/i);
    expect(spec.info.description).not.toMatch(/anonymous; document search/i);
    expect(spec.security).toEqual([{ ApiKeyAuth: [] }, { ApiKeyHeader: [] }]);
    expect(spec.paths["/documents"].get.responses["401"]).toBeDefined();
    expect(spec.paths["/entities"].get.responses["401"]).toBeDefined();
    expect(spec.paths["/timeline"].get.responses["401"]).toBeDefined();
  });
});

function request(
  path: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`https://example.test${path}`, { headers });
}
