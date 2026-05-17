import {
  sourceReliabilityDefinitions,
  type SourceReliabilityKind,
} from "./constants";
import type { DocumentCard, MentionExcerpt } from "./api-types";

export type { SourceReliabilityKind };

export type SourceReliabilityInfo = {
  kind: SourceReliabilityKind;
  label: string;
  description: string;
};

export function sourceReliabilityInfo(
  kind: SourceReliabilityKind | null | undefined,
): SourceReliabilityInfo {
  const safeKind = kind ?? "curated_metadata";
  const definition = sourceReliabilityDefinitions[safeKind];
  return {
    kind: safeKind,
    label: definition.label,
    description: definition.description,
  };
}

export function sourceReliabilityLabel(kind: SourceReliabilityKind): string {
  return sourceReliabilityInfo(kind).label;
}

export function sourceReliabilityDescription(kind: SourceReliabilityKind): string {
  return sourceReliabilityInfo(kind).description;
}

export function sourceReliabilityForDocument(
  doc: Pick<DocumentCard, "hasOcr">,
): SourceReliabilityKind {
  return doc.hasOcr ? "ocr_text" : "curated_metadata";
}

export function sourceReliabilityForMentionSource(
  source: MentionExcerpt["source"],
): SourceReliabilityKind {
  switch (source) {
    case "ocr":
      return "ocr_text";
    case "semantic":
      return "derived_signal";
    case "title":
    case "description":
    case "authority":
      return "curated_metadata";
  }
}
