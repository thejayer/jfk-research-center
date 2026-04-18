#!/usr/bin/env python3
"""
Ingest public-domain supplementary primary sources into BigQuery:

  1. Warren Commission Report        (archives.gov HTML chapters + appendices)
  2. ARRB Final Report               (archives.gov single ASCII file)
  3. Church Committee Book V         (Senate PDF -> pdftotext)

Output: two CSVs loaded into jfk_staging
  - primary_source_docs   (one row per source: doc_id, title, agency, year,
                           num_pages, source_url)
  - primary_source_chunks (one row per 1,200-char chunk with section label)

The companion SQL (sql/18_primary_sources.sql) promotes these into
jfk_records + jfk_text_chunks so they show up in the app's search and
document pages.

Usage:
    python3 scripts/ingest_primary_sources.py \\
      --out-dir /tmp/primary-sources \\
      --project jfk-vault \\
      --dataset jfk_staging
"""

import argparse
import csv
import os
import re
import subprocess
import sys
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

CHUNK_SIZE = 1200   # chars; matches the ABBYY ingest chunk size

# -- Source definitions -----------------------------------------------------

@dataclass
class SourceDoc:
    doc_id: str
    title: str
    agency: str
    year: int
    source_url: str

WARREN_BASE = "https://www.archives.gov/research/jfk/warren-commission-report/"
WARREN_URLS: list[tuple[str, str]] = (
    # (section_label, filename)
    [("Chapter " + str(i), f"chapter-{i}.html") for i in range(1, 9)]
    # Appendix naming at archives.gov is inconsistent — the 1-digit ones
    # use the bare `appendixN.html` pattern, except Appendix 1 which has a
    # leading zero (`appendix-01.html`); the 2-digit ones use a dash
    # (`appendix-NN.html`).
    + [("Appendix 1",  "appendix-01.html")]
    + [("Appendix 2",  "appendix2.html")]
    + [(f"Appendix {i}", f"appendix{i}.html") for i in range(3, 10)]
    + [(f"Appendix {i}", f"appendix-{i}.html") for i in range(10, 19)]
)

ARRB_TEXT_URL = "https://www.archives.gov/research/jfk/review-board/report/arrb-final-report.txt"

CHURCH_PDF_URL = "https://www.intelligence.senate.gov/wp-content/uploads/2024/08/sites-default-files-94755-v.pdf"


# -- HTML -> text stripper --------------------------------------------------

class TextExtractor(HTMLParser):
    """Collects visible text; drops <script>, <style>, and the site chrome."""

    SKIP_TAGS = {"script", "style", "nav", "header", "footer"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._skip_depth = 0
        # archives.gov wraps the report body in <div id="main-content">. We
        # use a looser filter: only collect inside <main> / <article> / body
        # and skip the obvious chrome tags.

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._skip_depth == 0:
            self._chunks.append(data)

    def text(self) -> str:
        out = "".join(self._chunks)
        # Collapse whitespace but preserve paragraph breaks (double-newline).
        out = re.sub(r"[ \t]+", " ", out)
        out = re.sub(r"\n[ \t]+", "\n", out)
        out = re.sub(r"\n{3,}", "\n\n", out)
        return out.strip()


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "jfk-research-center-ingest/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def html_to_text(html: bytes) -> str:
    parser = TextExtractor()
    parser.feed(html.decode("utf-8", errors="replace"))
    return parser.text()


def pdf_to_text(pdf_bytes: bytes, tmp_dir: Path) -> str:
    tmp_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = tmp_dir / "source.pdf"
    pdf_path.write_bytes(pdf_bytes)
    # -layout preserves reading order on multi-column PDFs.
    txt = subprocess.check_output(
        ["pdftotext", "-layout", str(pdf_path), "-"],
        stderr=subprocess.DEVNULL,
    )
    return txt.decode("utf-8", errors="replace")


# -- Chunking ---------------------------------------------------------------

def chunk_text(text: str, section_label: str | None) -> Iterable[tuple[int, str, str | None]]:
    """Yield (chunk_order, chunk_text, page_label) tuples.

    Chunks try to end at a paragraph break when possible; otherwise they
    hard-break at CHUNK_SIZE. Paragraph-aware chunks are easier to read
    and keep citation boundaries cleaner in the UI.
    """
    if not text.strip():
        return
    idx = 0
    order = 0
    n = len(text)
    while idx < n:
        end = min(idx + CHUNK_SIZE, n)
        # Prefer a paragraph boundary within the last 300 chars of the chunk.
        if end < n:
            back = text.rfind("\n\n", idx + CHUNK_SIZE - 300, end)
            if back > idx:
                end = back
            else:
                # Else try a sentence-ish boundary.
                back = text.rfind(". ", idx + CHUNK_SIZE - 200, end)
                if back > idx:
                    end = back + 1
        snippet = text[idx:end].strip()
        if snippet:
            yield (order, snippet, section_label)
            order += 1
        idx = end


# -- Ingesters --------------------------------------------------------------

def ingest_warren(out_dir: Path) -> tuple[SourceDoc, list[tuple[int, str, str | None]]]:
    print("[warren] scraping Warren Commission Report HTML chapters + appendices ...", flush=True)
    full_sections: list[tuple[str, str]] = []
    for label, filename in WARREN_URLS:
        url = WARREN_BASE + filename
        try:
            html = fetch(url)
            text = html_to_text(html)
            if len(text) < 200:
                print(f"[warren]   WARN: {filename} came back tiny ({len(text)} chars); skipping.", flush=True)
                continue
            full_sections.append((label, text))
            print(f"[warren]   {label:12s} {len(text):>8d} chars  ({filename})", flush=True)
        except Exception as e:
            print(f"[warren]   ERROR {filename}: {e}", flush=True)
    joined = "\n\n".join(f"## {label}\n\n{text}" for label, text in full_sections)
    full_path = out_dir / "warren-report.txt"
    full_path.write_text(joined)

    all_chunks: list[tuple[int, str, str | None]] = []
    order = 0
    for label, text in full_sections:
        for _, chunk, _ in chunk_text(text, section_label=label):
            all_chunks.append((order, chunk, label))
            order += 1
    print(f"[warren] -> {full_path} ({len(joined)} chars, {len(all_chunks)} chunks)", flush=True)
    return (
        SourceDoc(
            doc_id="ps-warren-report",
            title="Report of the President's Commission on the Assassination of President Kennedy (Warren Report)",
            agency="Warren Commission",
            year=1964,
            source_url="https://www.archives.gov/research/jfk/warren-commission-report",
        ),
        all_chunks,
    )


def ingest_arrb(out_dir: Path) -> tuple[SourceDoc, list[tuple[int, str, str | None]]]:
    print("[arrb] downloading ARRB Final Report ASCII ...", flush=True)
    text = fetch(ARRB_TEXT_URL).decode("utf-8", errors="replace")
    text = re.sub(r"\r\n?", "\n", text)
    (out_dir / "arrb-final-report.txt").write_text(text)
    chunks = list(chunk_text(text, section_label=None))
    print(f"[arrb] -> {len(text)} chars, {len(chunks)} chunks", flush=True)
    return (
        SourceDoc(
            doc_id="ps-arrb-report",
            title="Final Report of the Assassination Records Review Board",
            agency="Assassination Records Review Board",
            year=1998,
            source_url=ARRB_TEXT_URL,
        ),
        chunks,
    )


def ingest_church(out_dir: Path) -> tuple[SourceDoc, list[tuple[int, str, str | None]]]:
    print("[church] downloading Church Committee Book V PDF ...", flush=True)
    pdf = fetch(CHURCH_PDF_URL)
    text = pdf_to_text(pdf, out_dir / "church-pdf")
    (out_dir / "church-book-v.txt").write_text(text)
    chunks = list(chunk_text(text, section_label=None))
    print(f"[church] -> {len(text)} chars, {len(chunks)} chunks", flush=True)
    return (
        SourceDoc(
            doc_id="ps-church-book-v",
            title="Final Report of the Select Committee to Study Governmental Operations with Respect to Intelligence Activities — Book V: The Investigation of the Assassination of President John F. Kennedy",
            agency="U.S. Senate (Church Committee)",
            year=1976,
            source_url=CHURCH_PDF_URL,
        ),
        chunks,
    )


# -- CSV writers + BQ load --------------------------------------------------

def write_csvs(
    results: list[tuple[SourceDoc, list[tuple[int, str, str | None]]]],
    out_dir: Path,
) -> tuple[Path, Path]:
    docs_csv = out_dir / "primary_source_docs.csv"
    chunks_csv = out_dir / "primary_source_chunks.csv"

    with docs_csv.open("w", newline="") as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        w.writerow(["doc_id", "title", "agency", "year", "num_chunks", "total_chars", "source_url"])
        for doc, chunks in results:
            total_chars = sum(len(c[1]) for c in chunks)
            w.writerow([doc.doc_id, doc.title, doc.agency, doc.year, len(chunks), total_chars, doc.source_url])

    with chunks_csv.open("w", newline="") as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        w.writerow(["doc_id", "chunk_order", "chunk_text", "section_label"])
        for doc, chunks in results:
            for order, text, label in chunks:
                w.writerow([doc.doc_id, order, text, label or ""])

    print(f"-> wrote {docs_csv} ({len(results)} rows)", flush=True)
    print(f"-> wrote {chunks_csv} ({sum(len(c[1]) for c in results)} rows)", flush=True)
    return docs_csv, chunks_csv


def bq_load(project: str, dataset: str, docs_csv: Path, chunks_csv: Path) -> None:
    schema_docs = (
        "doc_id:STRING,title:STRING,agency:STRING,year:INTEGER,"
        "num_chunks:INTEGER,total_chars:INTEGER,source_url:STRING"
    )
    schema_chunks = "doc_id:STRING,chunk_order:INTEGER,chunk_text:STRING,section_label:STRING"

    for tbl, csv_path, schema in [
        ("primary_source_docs", docs_csv, schema_docs),
        ("primary_source_chunks", chunks_csv, schema_chunks),
    ]:
        full = f"{project}:{dataset}.{tbl}"
        print(f"-> bq load --replace {full}", flush=True)
        subprocess.check_call([
            "bq", "load",
            "--project_id", project,
            "--source_format=CSV",
            "--skip_leading_rows=1",
            "--allow_quoted_newlines",
            "--replace",
            full,
            str(csv_path),
            schema,
        ])


# -- Main -------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--project", default="jfk-vault")
    ap.add_argument("--dataset", default="jfk_staging")
    ap.add_argument("--skip-load", action="store_true", help="Write CSVs but don't run bq load.")
    ap.add_argument("--only", nargs="*", choices=["warren", "arrb", "church"],
                    help="Ingest only the named source(s).")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    results: list[tuple[SourceDoc, list[tuple[int, str, str | None]]]] = []
    wanted = set(args.only) if args.only else {"warren", "arrb", "church"}

    if "warren" in wanted:
        results.append(ingest_warren(out_dir))
    if "arrb" in wanted:
        results.append(ingest_arrb(out_dir))
    if "church" in wanted:
        results.append(ingest_church(out_dir))

    docs_csv, chunks_csv = write_csvs(results, out_dir)

    if not args.skip_load:
        bq_load(args.project, args.dataset, docs_csv, chunks_csv)

    print("\nDone. Next: run sql/18_primary_sources.sql to promote into curated.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
