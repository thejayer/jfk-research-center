import { describe, expect, it } from "vitest";
import {
  sourceReliabilityDescription,
  sourceReliabilityForDocument,
  sourceReliabilityForMentionSource,
  sourceReliabilityInfo,
  sourceReliabilityLabel,
} from "../source-reliability";

describe("source reliability helpers", () => {
  it("returns labels and descriptions for known badge kinds", () => {
    expect(sourceReliabilityLabel("primary_source")).toBe("Primary source");
    expect(sourceReliabilityDescription("research_lead")).toContain(
      "Open question",
    );
  });

  it("falls back to curated metadata when no kind is provided", () => {
    expect(sourceReliabilityInfo(undefined)).toMatchObject({
      kind: "curated_metadata",
      label: "Curated metadata",
    });
  });

  it("maps document OCR availability to the right badge kind", () => {
    expect(sourceReliabilityForDocument({ hasOcr: true })).toBe("ocr_text");
    expect(sourceReliabilityForDocument({ hasOcr: false })).toBe(
      "curated_metadata",
    );
    expect(sourceReliabilityForDocument({})).toBe("curated_metadata");
  });

  it("maps mention result sources to reliability badge kinds", () => {
    expect(sourceReliabilityForMentionSource("ocr")).toBe("ocr_text");
    expect(sourceReliabilityForMentionSource("semantic")).toBe("derived_signal");
    expect(sourceReliabilityForMentionSource("title")).toBe("curated_metadata");
    expect(sourceReliabilityForMentionSource("description")).toBe(
      "curated_metadata",
    );
    expect(sourceReliabilityForMentionSource("authority")).toBe(
      "curated_metadata",
    );
  });
});
