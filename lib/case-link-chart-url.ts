import type { CooccurrenceNode } from "./api-types";

export const graphTypeParamValues = [
  "person",
  "org",
  "place",
  "concept",
] as const satisfies readonly CooccurrenceNode["type"][];

export type CaseLinkChartUrlState = {
  yearFrom?: number;
  yearTo?: number;
  types?: CooccurrenceNode["type"][];
  node?: string;
  edge?: string;
  from?: string;
  to?: string;
};

type QuerySource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

const integerPattern = /^-?\d+$/;

/** Parses shareable /graph query params into a safe, trimmed chart state. */
export function parseCaseLinkChartUrlState(
  source: QuerySource,
): CaseLinkChartUrlState {
  const yearFrom = parseIntegerParam(readOne(source, "yearFrom"));
  const yearTo = parseIntegerParam(readOne(source, "yearTo"));
  const types = parseTypeParams(readMany(source, "type"));
  const state: CaseLinkChartUrlState = {};

  if (yearFrom != null) state.yearFrom = yearFrom;
  if (yearTo != null) state.yearTo = yearTo;
  if (types.length > 0) state.types = types;

  const node = cleanToken(readOne(source, "node"));
  const edge = cleanToken(readOne(source, "edge"));
  const from = cleanToken(readOne(source, "from"));
  const to = cleanToken(readOne(source, "to"));

  if (node) state.node = node;
  if (edge) state.edge = edge;
  if (from) state.from = from;
  if (to) state.to = to;

  return state;
}

/** Serializes graph controls in a stable order for replaceState/share links. */
export function serializeCaseLinkChartUrlState(
  state: CaseLinkChartUrlState,
): string {
  const params = new URLSearchParams();
  if (state.yearFrom != null) params.set("yearFrom", String(state.yearFrom));
  if (state.yearTo != null) params.set("yearTo", String(state.yearTo));
  for (const type of state.types ?? []) {
    if (isGraphType(type)) params.append("type", type);
  }
  setCleanParam(params, "node", state.node);
  setCleanParam(params, "edge", state.edge);
  setCleanParam(params, "from", state.from);
  setCleanParam(params, "to", state.to);
  return params.toString();
}

/** Guards node-type filter params before they reach chart state. */
export function isGraphType(value: string): value is CooccurrenceNode["type"] {
  return graphTypeParamValues.includes(value as CooccurrenceNode["type"]);
}

function parseTypeParams(values: string[]): CooccurrenceNode["type"][] {
  const seen = new Set<CooccurrenceNode["type"]>();
  for (const value of values) {
    const trimmed = value.trim();
    if (isGraphType(trimmed)) seen.add(trimmed);
  }
  return [...seen];
}

function parseIntegerParam(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !integerPattern.test(trimmed)) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function cleanToken(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function readOne(source: QuerySource, key: string): string | undefined {
  if (source instanceof URLSearchParams) {
    return source.get(key) ?? undefined;
  }
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

function readMany(source: QuerySource, key: string): string[] {
  if (source instanceof URLSearchParams) {
    return source.getAll(key);
  }
  const value = source[key];
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function setCleanParam(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  const cleaned = cleanToken(value);
  if (cleaned) params.set(key, cleaned);
}
