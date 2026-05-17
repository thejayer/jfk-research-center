# Public API Access Control

COM-60 defined the access-control layer for the public `/api/v1/*` API. COM-167
adds the first enforcement pass so expensive search surfaces have guardrails
before semantic search and future `/ask` use are expanded.

## Current State

The v1 API is read-only and CORS-open. Low-cost catalog endpoints stay
anonymous, document search is anonymously metered, and semantic search requires
an API key. The routes expose the same warehouse-backed data used by public
pages, with cache headers tuned for slow release-cadence data.

Current routes:

| Route | Current access | Target access | Cost class | Cache | Notes |
|---|---|---|---|---:|---|
| `GET /api/v1/openapi.json` | Anonymous | Anonymous | Static | 3600s | Keep public for client discovery. |
| `GET /api/v1/documents` | Anonymous metered | Anonymous metered | Warehouse | 300s | Query/filter combinations can create large BigQuery work. |
| `GET /api/v1/documents/{naid}` | Anonymous | Anonymous | Warehouse | 600s | Bounded record lookup. |
| `GET /api/v1/entities` | Anonymous | Anonymous | Warehouse | 600s | Small catalog surface. |
| `GET /api/v1/entities/{id}` | Anonymous | Anonymous | Warehouse | 600s | Bounded slug lookup. |
| `GET /api/v1/topics` | Anonymous | Anonymous | Warehouse | 600s | Small catalog surface. |
| `GET /api/v1/topics/{slug}` | Anonymous | Anonymous | Warehouse | 600s | Bounded slug lookup. |
| `GET /api/v1/timeline` | Anonymous | Anonymous | Warehouse | 600s | Bounded timeline index with local filtering. |
| `GET /api/v1/search/semantic` | Key required | Key required | Vertex | 60s | Generates embeddings for novel queries; requires a configured API key. |

The typed version of this inventory lives in `lib/public-api-access.ts` and is
covered by `lib/__tests__/public-api-access.test.ts`.

## Target Policy

Use three access modes:

- `anonymous`: public, cacheable, low-risk read endpoints.
- `anonymous_metered`: public endpoints allowed without a key, but with lower
  rate windows because query parameters affect warehouse cost.
- `key_required`: endpoints that should require an API key before public scale
  because they hit Vertex AI, future model calls, or other high-cost paths.

Initial target rate windows:

| Tier | Window |
|---|---:|
| Default anonymous reads | 120 requests/hour/IP |
| Anonymous document search | 60 requests/hour/IP |
| Keyed semantic search | 120 requests/hour/key |

These are starting points, not contractual public quotas.

## Key Model

Use opaque API keys, not user accounts, for the first version.

The first implementation accepts a comma-separated `JFK_API_KEYS` environment
variable and treats every configured key as an active `researcher` key. This is
enough to protect high-cost routes while the backing store is still simple.

Longer term, store per-key metadata in a small backing store such as Firestore:

- `keyHash`: hashed key, never store the raw key;
- `label`: human-readable owner/application label;
- `status`: `active`, `paused`, or `revoked`;
- `tier`: `researcher`, `partner`, or `internal`;
- `createdAt`, `lastSeenAt`;
- optional contact email;
- per-endpoint overrides when a specific collaborator needs a higher window.

Accept keys with `Authorization: Bearer <key>` and optionally
`X-JFKRC-API-Key` for simpler scripts. Prefer `Authorization` in docs.

## Rate-Limit Counters

The first implementation uses an in-memory counter per running server process.
This is intentionally conservative and easy to replace; it protects local and
single-process deployments but is not a durable distributed quota system.
Anonymous counters use a trusted platform-provided client IP when available.
Proxy headers such as `X-Forwarded-For`, `X-Real-IP`, and `CF-Connecting-IP`
are ignored unless `JFK_API_TRUST_PROXY_HEADERS=1`; only enable that flag when
the deployment sits behind trusted upstream proxies that strip incoming client
IP headers.

Durable counters should be keyed by:

- endpoint policy id/path;
- API key hash for keyed requests;
- IP address for anonymous requests;
- UTC window bucket.

Responses should use stable HTTP semantics:

- `401` when a key is required and missing;
- `403` when a key is revoked or not allowed for the endpoint;
- `429` when the caller exceeds the active window;
- `503` when an endpoint kill switch is active.

Return JSON errors using the existing public API error shape:

```json
{ "error": "rate limit exceeded" }
```

Add `Retry-After` on `429` responses and avoid leaking key existence through
different error messages.

## Endpoint Kill Switches

High-cost routes should support environment kill switches before the public
assistant ships:

- `JFK_API_DISABLE_DOCUMENT_SEARCH`
- `JFK_API_DISABLE_SEMANTIC_SEARCH`
- future `JFK_API_DISABLE_ASK`

Kill switches should fail closed with `503` and a short public error message.

## Rollout Sequence

1. Land this policy inventory and documentation. Done in COM-60.
2. Add route-helper enforcement that reads `lib/public-api-access.ts`. Done in
   COM-167.
3. Update OpenAPI with security schemes and `429` / `401` / `403` responses.
   Done in COM-167.
4. Turn on metering for `GET /api/v1/documents`. Done in COM-167.
5. Require keys for `GET /api/v1/search/semantic`. Done in COM-167.
6. Replace the environment/in-memory key and counter store with durable
   hashed-key metadata and distributed counters.
7. Reuse the same policy layer for `/ask` before public launch.

## Non-Goals

- No billing.
- No account dashboard.
- No write API.
- No public BigQuery mirror changes; that belongs to COM-61.
