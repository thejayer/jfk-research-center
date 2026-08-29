/**
 * Helpers for classifying BigQuery client errors without leaking job SQL.
 */

type BigQueryErrorLike = {
  code?: unknown;
  message?: unknown;
  errors?: Array<{ reason?: unknown; message?: unknown }>;
};

/**
 * Returns true when BigQuery refused a job for exceeding maximumBytesBilled.
 *
 * The Node client surfaces this as a 400 with reason `bytesBilledLimitExceeded`
 * and a message that includes "bytes billed".
 */
export function isBigQueryBytesBilledExceeded(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as BigQueryErrorLike;
  if (
    Array.isArray(candidate.errors) &&
    candidate.errors.some((item) => isBytesBilledReason(item.reason, item.message))
  ) {
    return true;
  }
  return isBytesBilledReason(undefined, candidate.message);
}

/**
 * Returns true when a job failed because a table (or dataset) is missing.
 * Used to degrade search to metadata-only until sql/33 is applied.
 */
export function isBigQueryNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as BigQueryErrorLike;
  if (
    Array.isArray(candidate.errors) &&
    candidate.errors.some((item) => isNotFoundReason(item.reason, item.message))
  ) {
    return true;
  }
  return isNotFoundReason(candidate.code, candidate.message);
}

function isBytesBilledReason(reason: unknown, message: unknown): boolean {
  if (reason === "bytesBilledLimitExceeded") return true;
  return typeof message === "string" && /bytes billed/i.test(message);
}

function isNotFoundReason(reason: unknown, message: unknown): boolean {
  if (reason === "notFound" || reason === 404 || reason === "404") return true;
  return (
    typeof message === "string" &&
    /not found: (table|dataset)|notfound/i.test(message)
  );
}
