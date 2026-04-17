#!/bin/bash
#
# scripts/rebuild_warehouse.sh
#
# Run the SQL files that promote ABBYY staging data into the curated and
# MVP layers. Assumes:
#   - jfk_raw.nara_manifest is populated (scripts/normalize_nara_manifests.py)
#   - jfk_staging.abbyy_documents + jfk_staging.abbyy_text_chunks are
#     populated (scripts/ingest_abbyy.py)
#
# Usage:
#   ./scripts/rebuild_warehouse.sh [--project jfk-vault] [--skip-indexes]
#
# The script runs each SQL file with `bq query`; stops on first failure.

set -euo pipefail

PROJECT="${JFK_BQ_PROJECT:-jfk-vault}"
SKIP_INDEXES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)       PROJECT="$2"; shift 2 ;;
    --skip-indexes)  SKIP_INDEXES=1; shift ;;
    -h|--help)       sed -n '/^# /p' "$0" | head -25; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

SQL_DIR="$(cd "$(dirname "$0")/../sql" && pwd)"

run_sql() {
  local file="$1"
  echo "==> $(basename "$file")"
  bq query \
    --project_id="$PROJECT" \
    --use_legacy_sql=false \
    --format=none \
    < "$file"
}

# Order matters. Don't reshuffle.
FILES=(
  "10_curated_jfk_records.sql"
  "05_abbyy_to_nara_map.sql"
  "12_curated_jfk_entities.sql"
  "11_curated_jfk_text_chunks.sql"
  "13_curated_jfk_document_entity_map.sql"
  "20_mvp_oswald_mentions.sql"
  "21_mvp_topic_views.sql"
  "90_dq_reports.sql"
)

if [[ $SKIP_INDEXES -ne 1 ]]; then
  FILES+=("30_search_indexes.sql")
fi

for f in "${FILES[@]}"; do
  run_sql "$SQL_DIR/$f"
done

echo "==> all done"
echo
echo "Spot-check with:"
echo "  bq query --project_id=$PROJECT --use_legacy_sql=false \\"
echo "    'SELECT * FROM \`$PROJECT.jfk_staging.dq_join_summary\`'"
