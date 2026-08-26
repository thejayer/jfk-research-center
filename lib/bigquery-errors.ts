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

function isBytesBilledReason(reason: unknown, message: unknown): boolean {
  if (reason === "bytesBilledLimitExceeded") return true;
  return typeof message === "string" && /bytes billed/i.test(message);
}
