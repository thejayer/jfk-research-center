import { describe, expect, it } from "vitest";
import {
  findPublicApiEndpointPolicy,
  publicApiEndpointPolicies,
} from "../public-api-access";

const WAREHOUSE_OR_VERTEX_PATHS = [
  "/api/v1/documents",
  "/api/v1/documents/{naid}",
  "/api/v1/entities",
  "/api/v1/entities/{id}",
  "/api/v1/topics",
  "/api/v1/topics/{slug}",
  "/api/v1/timeline",
  "/api/v1/search/semantic",
] as const;

describe("publicApiEndpointPolicies", () => {
  it("covers the current public v1 route inventory once each", () => {
    const keys = publicApiEndpointPolicies.map(
      (policy) => `${policy.method} ${policy.path}`,
    );

    expect(keys).toEqual([
      "GET /api/v1/openapi.json",
      "GET /api/v1/documents",
      "GET /api/v1/documents/{naid}",
      "GET /api/v1/entities",
      "GET /api/v1/entities/{id}",
      "GET /api/v1/topics",
      "GET /api/v1/topics/{slug}",
      "GET /api/v1/timeline",
      "GET /api/v1/search/semantic",
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("requires keys on every warehouse and Vertex route", () => {
    for (const path of WAREHOUSE_OR_VERTEX_PATHS) {
      const policy = findPublicApiEndpointPolicy("GET", path);
      expect(policy, path).not.toBeNull();
      expect(policy?.currentAccess, path).toBe("key_required");
      expect(policy?.targetAccess, path).toBe("key_required");
      expect(policy?.anonymousLimit, path).toBeNull();
      expect(policy?.keyedLimit?.requests, path).toBeGreaterThan(0);
    }
  });

  it("keeps the expensive semantic route keyed with a Vertex kill switch", () => {
    const policy = findPublicApiEndpointPolicy(
      "GET",
      "/api/v1/search/semantic",
    );

    expect(policy?.costClass).toBe("vertex");
    expect(policy?.currentAccess).toBe("key_required");
    expect(policy?.targetAccess).toBe("key_required");
    expect(policy?.anonymousLimit).toBeNull();
    expect(policy?.killSwitch).toBe("JFK_API_DISABLE_SEMANTIC_SEARCH");
  });

  it("keeps static discovery anonymous", () => {
    const policy = findPublicApiEndpointPolicy("GET", "/api/v1/openapi.json");

    expect(policy?.currentAccess).toBe("anonymous");
    expect(policy?.targetAccess).toBe("anonymous");
    expect(policy?.costClass).toBe("static");
  });

  it("matches dynamic route templates", () => {
    expect(
      findPublicApiEndpointPolicy("GET", "/api/v1/documents/193887")?.path,
    ).toBe("/api/v1/documents/{naid}");
    expect(
      findPublicApiEndpointPolicy("GET", "/api/v1/entities/oswald")?.path,
    ).toBe("/api/v1/entities/{id}");
    expect(
      findPublicApiEndpointPolicy("GET", "/api/v1/topics/mexico-city")?.path,
    ).toBe("/api/v1/topics/{slug}");
  });

  it("normalizes lowercase HTTP methods before matching", () => {
    expect(findPublicApiEndpointPolicy("get", "/api/v1/documents")?.path).toBe(
      "/api/v1/documents",
    );
  });

  it("does not match unknown methods or routes", () => {
    expect(findPublicApiEndpointPolicy("POST", "/api/v1/documents")).toBeNull();
    expect(findPublicApiEndpointPolicy("GET", "/api/v1/ask")).toBeNull();
    expect(
      findPublicApiEndpointPolicy("GET", "/api/document/104-10086-10152/ocr"),
    ).toBeNull();
    expect(findPublicApiEndpointPolicy("GET", "/api/search")).toBeNull();
  });
});
