# Public API Access Control

COM-60 defined the access-control layer for the public `/api/v1/*` API. COM-167
added the first enforcement pass. Warehouse and Vertex endpoints now require an
API key; the OpenAPI contract stays readable without one.

## Current State

The v1 API is read-only. CORS stays open so browser clients can send
`Authorization` or `X-JFKRC-API-Key`, but that is not anonymous access.
Warehouse and Vertex routes require a configured API key and are rate-limited
per key. `GET /api/v1/openapi.json` remains anonymous so the contract is
discoverable. First-party site pages continue to use `/api/search` and
`/api/document`, which are not gated by this layer.

Current routes:

| Route | Current access | Target access | Cost class | Cache | Notes |
|---|---|---|---|---:|---|
| `GET /api/v1/openapi.json` | Anonymous | Anonymous | Static | 3600s | Keep public for client discovery. |
| `GET /api/v1/documents` | Key required | Key required | Warehouse | 300s | Query/filter combinations can create large BigQuery work. |
| `GET /api/v1/documents/{naid}` | Key required | Key required | Warehouse | 600s | Bounded record lookup. |
| `GET /api/v1/entities` | Key required | Key required | Warehouse | 600s | Small catalog surface; still warehouse-backed. |
| `GET /api/v1/entities/{id}` | Key required | Key required | Warehouse | 600s | Bounded slug lookup. |
| `GET /api/v1/topics` | Key required | Key required | Warehouse | 600s | Small catalog surface; still warehouse-backed. |
| `GET /api/v1/topics/{slug}` | Key required | Key required | Warehouse | 600s | Bounded slug lookup. |
| `GET /api/v1/timeline` | Key required | Key required | Warehouse | 600s | Bounded timeline index with local filtering. |
| `GET /api/v1/search/semantic` | Key required | Key required | Vertex | 60s | Generates embeddings for novel queries; requires a configured API key. |

The typed version of this inventory lives in `lib/public-api-access.ts` and is
covered by `lib/__tests__/public-api-access.test.ts`. Every listed route calls
`enforcePublicApiAccess` (via `denyUnauthorizedPublicApi`) before warehouse or
Vertex work.

## Target Policy

Use three access modes:

- `anonymous`: public, cacheable, low-risk read endpoints (OpenAPI only).
- `anonymous_metered`: reserved for any future public endpoint allowed without
  a key but with a lower rate window.
- `key_required`: warehouse, Vertex, and other high-cost paths. Callers must
  present an active API key.

Initial rate windows:

| Tier | Window |
|---|---:|
| Default anonymous reads | 120 requests/hour/IP (OpenAPI) |
| Default keyed warehouse reads | 120 requests/hour/key |
| Keyed semantic search | 120 requests/hour/key |

These are starting points, not contractual public quotas.

Production also keeps the existing Cloud Run / middleware cost gates and Cloud
Armor throttle on `/api/v1/documents`. Those sit in front of this layer; do
not remove them.

## Key Model

Use opaque API keys, not user accounts, for the first version.

The first implementation accepts a comma-separated `JFK_API_KEYS` environment
variable and treats every configured key as an active `researcher` key. Deploy
passes that value from the GitHub Actions secret of the same name into Cloud
Run. Do not commit production keys.

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
4. Turn on metering for `GET /api/v1/documents`. Done in COM-167; superseded
   by key-required warehouse access.
5. Require keys for `GET /api/v1/search/semantic`. Done in COM-167.
6. Require keys for all warehouse `/api/v1` routes. Done.
7. Replace the environment/in-memory key and counter store with durable
   hashed-key metadata and distributed counters.
8. Reuse the same policy layer for `/ask` before public launch.

## Non-Goals

- No billing.
- No account dashboard.
- No write API.
- No public BigQuery mirror changes; that belongs to COM-61.
