import { describe, expect, it } from "vitest";
import {
  warehouseJobLabels,
  warehouseRequestContextFromHeaders,
  withWarehouseRequestContext,
} from "../warehouse-request-context";

describe("warehouse request context", () => {
  it("propagates bounded request attribution into BigQuery labels", async () => {
    const headers = new Headers({
      "x-jfk-request-id": "request_123",
      "x-jfk-request-fingerprint": "abcdef0123456789",
      "x-jfk-traffic-class": "legacy_mobile_automation",
    });
    const context = warehouseRequestContextFromHeaders(
      headers,
      "api/search",
      "mention",
    );

    await withWarehouseRequestContext(context, async () => {
      expect(warehouseJobLabels()).toEqual({
        app: "jfk_research_center",
        request_id: "request_123",
        request_fingerprint: "abcdef0123456789",
        traffic_class: "legacy_mobile_automation",
        route: "api_search",
        search_mode: "mention",
      });
    });
  });

  it("drops malformed identifiers and unknown traffic classes", () => {
    const context = warehouseRequestContextFromHeaders(
      new Headers({
        "x-jfk-request-id": "bad id",
        "x-jfk-request-fingerprint": "raw query text",
        "x-jfk-traffic-class": "made_up",
      }),
      "api/search",
    );

    expect(context).toMatchObject({
      requestId: "",
      requestFingerprint: "",
      trafficClass: "unknown",
      route: "api_search",
    });
  });
});
