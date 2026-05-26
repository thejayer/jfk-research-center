# JFK Library Media Ingestion

## Goal

Build a rights-aware path for official JFK Library images and media without assuming every search result can be copied into site storage.

## Source Policy

Use the JFK Library as the system of record for candidate media:

- Search entry point: https://www.jfklibrary.org/search?items_per_page=25&sort_by=search_api_relevance&sort_order=DESC
- Copyright guidance: https://www.jfklibrary.org/archives/research-support-services/copyright
- Reproduction guidance: https://www.jfklibrary.org/archives/research-support-services/reproductions
- Kennedy Family Collection licensing: https://www.jfklibrary.org/about-us/jfk-library-foundation/licensing-photographs-in-the-kennedy-family-collection

The first ingestion step stores metadata only: title, collection, digital identifier, date, media type, source URL, credit line, rights status, and storage status.

## Rights Statuses

- `public_domain_likely`: metadata indicates official federal-government creation, but item-level restrictions still need review before caching binaries.
- `permission_required`: the collection or rights owner requires written permission before reuse or local image storage.
- `copyright_unknown`: provenance or creator status is unclear, so keep source links only.
- `metadata_only`: useful as a source pointer, but not a storage candidate.

## Storage Rules

1. Never bulk-download search results directly into the app.
2. Every media row must keep the official source URL and credit line.
3. Local image storage requires item-level rights review.
4. Permission-required and copyright-unknown items remain metadata-only.
5. Cached files should use stable asset IDs and preserve enough provenance to rebuild the manifest.

## Next Implementation Step

Use `npm run media:ingest:dry-run` to validate the curated seed list without network access or file writes.

Use `npm run media:ingest -- --input data/media/jfkl-media-seeds.json --output data/media/jfkl-media-manifest.json` to fetch JFK Library asset pages and write a metadata manifest.

Only use `npm run media:ingest -- --download-cleared` after item-level review confirms that every `eligible_for_cache` seed can be locally stored. The script still skips permission-required, copyright-unknown, and metadata-only items.

## Seed Format

Curated seeds live in `data/media/jfkl-media-seeds.json`. Each seed must include `sourceUrl` and should include explicit `rightsStatus`, `storageStatus`, `rightsNote`, and `storageNote` values. Missing rights values default to `copyright_unknown` and `metadata_only`.
