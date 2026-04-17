# Warehouse overview

The JFK Research Center warehouse separates metadata authority (NARA) from
OCR authority (ABBYY) and joins them in a provenance-preserving map.

## Layers

```
jfk_raw            — untransformed source dumps
    nara_manifest      (rows from the 2017-18, 2021, 2022, 2023 XLSX files)

jfk_staging        — ABBYY OCR staging, pre-join
    abbyy_documents
    abbyy_text_chunks
    abbyy_to_nara_map

jfk_curated        — canonical models the API reads from
    jfk_records
    jfk_text_chunks
    jfk_entities
    jfk_document_entity_map

jfk_mvp            — per-topic and per-entity views for page-level queries
    oswald_mentions, ruby_mentions, cia_docs, fbi_docs, hsca_docs,
    warren_commission_docs, mexico_city_docs, cuba_docs,
    timeline_1963_docs, featured_documents
```

## Source authorities

| Layer | Source | Role |
|---|---|---|
| Metadata | NARA JFK Records Collection XLSX manifests | Canonical record identity, dates, agencies, titles, release history |
| OCR text | [abbyy/JFK-OCR](https://github.com/abbyy/JFK-OCR) | Full-text, per-page searchable content (2,176 unique RIFs as of 2025 release) |
| Curated | Both, joined by RIF | What the app queries |

## Ingestion order

Run SQL files in the order encoded in their prefix. `nn_*.sql` files are
idempotent (`CREATE OR REPLACE`).

| File | Produces | Depends on |
|---|---|---|
| *(manual)* NARA manifest CSV load | `jfk_raw.nara_manifest` | XLSX manifests from archives.gov |
| *(manual)* ABBYY ingestion script | `jfk_staging.abbyy_documents`, `jfk_staging.abbyy_text_chunks` | `scripts/ingest_abbyy.py` |
| `sql/05_abbyy_to_nara_map.sql` | `jfk_staging.abbyy_to_nara_map` | nara_manifest, abbyy_documents |
| `sql/10_curated_jfk_records.sql` | `jfk_curated.jfk_records` | nara_manifest |
| `sql/11_curated_jfk_text_chunks.sql` | `jfk_curated.jfk_text_chunks` | abbyy_text_chunks, abbyy_to_nara_map, jfk_records |
| `sql/12_curated_jfk_entities.sql` | `jfk_curated.jfk_entities` | (none) |
| `sql/13_curated_jfk_document_entity_map.sql` | `jfk_curated.jfk_document_entity_map` | jfk_records, jfk_text_chunks, jfk_entities |
| `sql/20_mvp_oswald_mentions.sql` | `jfk_mvp.oswald_mentions` | jfk_text_chunks, jfk_records |
| `sql/21_mvp_topic_views.sql` | All topic + featured tables | jfk_records, jfk_document_entity_map |
| `sql/30_search_indexes.sql` | Search indexes | jfk_records, jfk_text_chunks |
| `sql/90_dq_reports.sql` | DQ views | staging + curated layers |

## Join strategy (ABBYY → NARA)

`abbyy_to_nara_map` resolves one ABBYY document to one NARA record. Match
methods, ordered by preference:

| Method | normalized_key | match_confidence | Notes |
|---|---|---|---|
| `exact_rif` | RIF extracted from filename (e.g. `104-10004-10156`) | `high` | Primary path — 99.4% of ABBYY records match this way |
| `parenthetical_strip` | RIF after stripping `(C0xxxxxx)` suffix | `high` | Secondary variants that point at the same RIF |
| `unmapped` | — | `none` | Logged in `jfk_staging.vw_unmatched_abbyy` |

## Promoting OCR into `curated.jfk_text_chunks`

`jfk_curated.jfk_text_chunks` is a union with a `source_type` discriminator:

| source_type | Meaning | Chunk size |
|---|---|---|
| `abbyy_ocr` | Text extracted from the ABBYY-enhanced PDF (preferred) | ~1,200 chars |
| `nara_ocr` | (reserved — unused in MVP, if NARA adds an OCR layer later) | — |
| `description` | Fallback chunk synthesized from the NARA description field | whole description |

Within any single `document_id`, `abbyy_ocr` chunks, when present, override
`description` chunks. The `document_id` has at most one source layer at a time.

## Provenance

Every chunk row keeps the fields needed to trace back to both sources:

- `document_id` + `naid` → NARA record in `jfk_curated.jfk_records`
- `abbyy_doc_id` + `source_filename` → row in `jfk_staging.abbyy_documents`
- `match_method` + `match_confidence` → join transparency

## Assumed raw.nara_manifest shape

Columns populated by `scripts/normalize_nara_manifests.py`:

| Column | Type | Source |
|---|---|---|
| `record_num` | STRING | Record Num / Record Number |
| `file_name` | STRING | File Name / File Title |
| `release_date` | STRING | NARA Release Date |
| `formerly_withheld` | STRING | Formerly Withheld |
| `agency` | STRING | Agency (may be null for 2021/2022) |
| `doc_date` | STRING | Doc Date / Document Date |
| `doc_type` | STRING | Doc Type / Document Type |
| `file_num` | STRING | File Num / File Number |
| `to_name` | STRING | To Name / To |
| `from_name` | STRING | From Name / From |
| `title` | STRING | Title |
| `num_pages` | STRING | Num Pages / Original Document Pages |
| `originator` | STRING | Originator |
| `record_series` | STRING | Record Series |
| `review_date` | STRING | Review Date |
| `comments` | STRING | Comments |
| `pages_released` | STRING | Pages Released / Document Pages in PDF |
| `release_set` | STRING | Derived: 2017-2018 / 2021 / 2022 / 2023 |
| `agency_from_prefix` | STRING | Derived from RIF prefix (104 = CIA, 124 = FBI, …) |
| `pdf_url` | STRING | Full archives.gov URL |

## Assumed staging.abbyy_documents shape

Columns populated by `scripts/ingest_abbyy.py`:

| Column | Type | Notes |
|---|---|---|
| `abbyy_doc_id` | STRING | Stable id, typically the normalized RIF |
| `source_filename` | STRING | Original filename in the ABBYY repo |
| `source_path` | STRING | Path under `Data/` |
| `normalized_key` | STRING | RIF after parenthetical strip |
| `title_guess` | STRING | First non-boilerplate line of extracted text |
| `release_batch` | STRING | Always `2025-release` for the current ABBYY corpus |
| `raw_text` | STRING | Full pdftotext output |
| `raw_json` | JSON | Optional: `{pdf_bytes, page_count, extraction_tool, extracted_at}` |
| `source_repo` | STRING | `abbyy/JFK-OCR` (and commit SHA) |
