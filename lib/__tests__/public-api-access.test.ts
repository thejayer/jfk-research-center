import { describe, expect, it } from "vitest";
import {
  findPublicApiEndpointPolicy,
  publicApiEndpointPolicies,
} from "../public-api-access";

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

  it("keeps the expensive semantic route keyed in the target design", () => {
    const policy = findPublicApiEndpointPolicy(
      "GET",
      "/api/v1/search/semantic",
    );

    expect(policy?.costClass).toBe("vertex");
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
  });
});
