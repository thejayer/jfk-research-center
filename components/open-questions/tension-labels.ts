import { tensionOrder } from "@/lib/constants";

/**
 * Shared labels + display order for the six tension types that sql/27
 * assigns to each batch-level question.
 */

export const TENSION_ORDER = tensionOrder;

export function tensionLabel(t: string | null | undefined): string {
  switch (t) {
    case "contradiction":
      return "Contradiction";
    case "timing":
      return "Timing oddity";
    case "redaction":
      return "Redaction pattern";
    case "unexplained_reference":
      return "Unexplained reference";
    case "pattern":
      return "Pattern";
    case "gap":
      return "Gap in the record";
    default:
      return "Other";
  }
}

export function tensionAnchorId(t: string | null | undefined): string {
  const slug = (t ?? "other")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `underlying-threads-${slug || "other"}`;
}
