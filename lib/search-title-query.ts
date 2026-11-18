const DOCUMENT_TYPE_LABELS = new Set([
  "airtel",
  "cable",
  "correspondence",
  "dispatch",
  "fbi report",
  "information report",
  "letter",
  "memo",
  "memorandum",
  "notes",
  "photograph",
  "report",
  "routing slip",
  "telegram",
  "teletype",
  "testimony",
  "textual record",
  "transmittal",
]);

export function normalizeTitleQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isTitleLikeQuery(query: string): boolean {
  const match = /^([A-Za-z][A-Za-z./-]*(?:\s+[A-Za-z][A-Za-z./-]*){0,3}):(?!\/\/)\s*\S/.exec(
    query.trim(),
  );
  if (!match) return false;

  const label = match[1];
  return (
    DOCUMENT_TYPE_LABELS.has(normalizeTitleQuery(label)) ||
    (label === label.toUpperCase() && label.replace(/[^A-Z]/g, "").length >= 3)
  );
}
