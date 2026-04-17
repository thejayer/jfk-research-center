/**
 * API client used by server components.
 *
 * This module is the single point of data access for pages. It calls
 * the internal Next.js API routes so the UI never imports mock-data
 * or warehouse code directly.
 *
 * In production, JFK_API_BASE_URL may point to a Cloud Run service or
 * an absolute URL for a separate deployment. In local development, the
 * same-host API routes are used via an absolute URL derived from
 * the request headers.
 */

import { headers } from "next/headers";
import type {
  DocumentResponse,
  EntityResponse,
  HomeResponse,
  SearchResponse,
  TopicCard,
  TopicResponse,
} from "./api-types";

async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.JFK_API_BASE_URL;
  if (envUrl && envUrl.startsWith("http")) return envUrl.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

type FetchOpts = {
  /** Cache hint forwarded to Next's fetch. */
  revalidate?: number;
  /** No-store for per-request responses. */
  noStore?: boolean;
};

async function get<T>(path: string, opts: FetchOpts = {}): Promise<T | null> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...(opts.noStore
      ? { cache: "no-store" as const }
      : { next: { revalidate: opts.revalidate ?? 60 } }),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${path}`);
  }
  return (await res.json()) as T;
}

export async function fetchHome(): Promise<HomeResponse> {
  const data = await get<HomeResponse>("/api/home", { revalidate: 600 });
  if (!data) throw new Error("Home payload missing");
  return data;
}

export async function fetchSearch(
  query: string,
  mode: "document" | "mention" = "document",
  filters: {
    agency?: string[];
    year?: string[];
    entity?: string[];
    topic?: string[];
    confidence?: string[];
  } = {},
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (mode !== "document") params.set("mode", mode);
  for (const k of ["agency", "year", "entity", "topic", "confidence"] as const) {
    for (const v of filters[k] ?? []) params.append(k, v);
  }
  const qs = params.toString();
  const path = qs ? `/api/search?${qs}` : "/api/search";
  const data = await get<SearchResponse>(path, { noStore: true });
  if (!data) throw new Error("Search payload missing");
  return data;
}

export async function fetchEntity(slug: string): Promise<EntityResponse | null> {
  return get<EntityResponse>(`/api/entity/${encodeURIComponent(slug)}`, {
    revalidate: 600,
  });
}

export async function fetchTopic(slug: string): Promise<TopicResponse | null> {
  return get<TopicResponse>(`/api/topic/${encodeURIComponent(slug)}`, {
    revalidate: 600,
  });
}

export async function fetchTopics(): Promise<TopicCard[]> {
  const data = await get<{ topics: TopicCard[] }>("/api/topics", {
    revalidate: 600,
  });
  return data?.topics ?? [];
}

export async function fetchDocument(id: string): Promise<DocumentResponse | null> {
  return get<DocumentResponse>(`/api/document/${encodeURIComponent(id)}`, {
    revalidate: 600,
  });
}
