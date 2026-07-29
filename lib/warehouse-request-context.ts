import { AsyncLocalStorage } from "node:async_hooks";
import {
  JFK_REQUEST_FINGERPRINT_HEADER,
  JFK_REQUEST_ID_HEADER,
  JFK_TRAFFIC_CLASS_HEADER,
  normalizeRequestFingerprint,
  normalizeRequestId,
} from "./cost-request";
import type { CostTrafficClass } from "./cost-controls";

export type WarehouseRequestContext = {
  requestId: string;
  requestFingerprint: string;
  trafficClass: CostTrafficClass | "unknown";
  route: string;
  searchMode?: "document" | "mention" | "semantic";
};

const storage = new AsyncLocalStorage<WarehouseRequestContext>();
const TRAFFIC_CLASSES = new Set<WarehouseRequestContext["trafficClass"]>([
  "known_crawler",
  "legacy_mobile_automation",
  "server_fetch",
  "browser",
  "unknown",
]);

export function warehouseRequestContextFromHeaders(
  headers: Headers,
  route: string,
  searchMode?: WarehouseRequestContext["searchMode"],
): WarehouseRequestContext {
  const trafficClass = normalizeTrafficClass(
    headers.get(JFK_TRAFFIC_CLASS_HEADER),
  );
  return {
    requestId: normalizeRequestId(headers.get(JFK_REQUEST_ID_HEADER)),
    requestFingerprint: normalizeRequestFingerprint(
      headers.get(JFK_REQUEST_FINGERPRINT_HEADER),
    ),
    trafficClass,
    route: normalizeLabelValue(route) || "unknown",
    ...(searchMode ? { searchMode } : {}),
  };
}

function normalizeTrafficClass(
  value: string | null,
): WarehouseRequestContext["trafficClass"] {
  const normalized = normalizeLabelValue(value);
  return TRAFFIC_CLASSES.has(
    normalized as WarehouseRequestContext["trafficClass"],
  )
    ? (normalized as WarehouseRequestContext["trafficClass"])
    : "unknown";
}

export function withWarehouseRequestContext<T>(
  context: WarehouseRequestContext,
  callback: () => Promise<T>,
): Promise<T> {
  return storage.run(context, callback);
}

export function warehouseJobLabels(): Record<string, string> {
  const context = storage.getStore();
  const labels: Record<string, string> = {
    app: "jfk_research_center",
  };
  if (!context) return labels;

  addLabel(labels, "request_id", context.requestId);
  addLabel(labels, "request_fingerprint", context.requestFingerprint);
  addLabel(labels, "traffic_class", context.trafficClass);
  addLabel(labels, "route", context.route);
  addLabel(labels, "search_mode", context.searchMode);
  return labels;
}

function addLabel(
  labels: Record<string, string>,
  key: string,
  value: string | undefined,
): void {
  const normalized = normalizeLabelValue(value ?? "");
  if (normalized) labels[key] = normalized;
}

function normalizeLabelValue(value: string | null): string {
  return value
    ?.toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 63) ?? "";
}
