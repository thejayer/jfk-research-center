/**
 * Shared labels + display order for the six tension types that sql/27
 * assigns to each batch-level question.
 */

export const TENSION_ORDER = [
  "contradiction",
  "timing",
  "unexplained_reference",
  "redaction",
  "gap",
  "pattern",
] as const;

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
