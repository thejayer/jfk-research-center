#!/usr/bin/env python3
"""
scripts/ingest_abbyy.py

End-to-end ingestion of the abbyy/JFK-OCR repo into BigQuery staging tables.

Pipeline (streaming mode — default):
  1. List the files under Data/ by calling the GitHub tree API (no clone).
  2. For each PDF, download to a single temp file via the LFS media URL,
     extract text + page count with pdftotext, then delete the temp file.
  3. Emit two CSV files (one doc per row + chunked text) incrementally.
  4. Load both CSVs into BigQuery via `bq load`.

This mode never keeps more than one PDF on disk at a time, so it works on
tiny VMs.

Pipeline (clone mode — --clone flag):
  Clone the repo with git, `git lfs pull`, then process. Faster for
  repeat runs but requires ~300 MB of free disk.

Outputs (in --out-dir):
  abbyy_documents.csv   → jfk_staging.abbyy_documents
  abbyy_text_chunks.csv → jfk_staging.abbyy_text_chunks

Env expectations:
  - pdftotext (poppler-utils) on PATH
  - git + git-lfs on PATH (clone mode only)
  - curl on PATH (streaming mode)
  - `bq` authenticated for the target project

Idempotent: re-running rebuilds the CSVs and replaces the staging tables.

Usage:
  # Streaming (default; disk-safe):
  python3 scripts/ingest_abbyy.py \
      --out-dir /tmp/abbyy-out \
      --project jfk-vault --dataset jfk_staging

  # Clone once, process locally:
  python3 scripts/ingest_abbyy.py --clone \
      --repo-dir /tmp/abbyy/JFK-OCR \
      --out-dir /tmp/abbyy-out \
      --project jfk-vault --dataset jfk_staging

  # Limit to first N docs for quick sanity check:
  python3 scripts/ingest_abbyy.py --limit 25 --skip-load
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Iterator, Optional
from urllib.parse import quote
from urllib.request import Request, urlopen

ABBYY_REPO_URL = "https://github.com/abbyy/JFK-OCR.git"
ABBYY_OWNER = "abbyy"
ABBYY_REPO = "JFK-OCR"
ABBYY_BRANCH = "main"
ABBYY_MEDIA_BASE = (
    f"https://media.githubusercontent.com/media/{ABBYY_OWNER}/{ABBYY_REPO}/{ABBYY_BRANCH}/Data"
)
GITHUB_TREE_API = (
    f"https://api.github.com/repos/{ABBYY_OWNER}/{ABBYY_REPO}/git/trees/{ABBYY_BRANCH}"
    "?recursive=1"
)
CHUNK_CHAR_BUDGET = 1200
MIN_CHUNK_CHARS = 40
RELEASE_BATCH_DEFAULT = "2025-release"

# Filename RIF regex: 3 digits - 5 digits - 5 digits, optionally
# followed by a space + parenthetical suffix.
FILENAME_RE = re.compile(
    r"^(?P<rif>\d{3}-\d{5}-\d{5})(?:\s*\((?P<suffix>[^)]+)\))?\.pdf$",
    re.IGNORECASE,
)

BOILERPLATE_FRAGMENTS = (
    "2025 RELEASE UNDER THE PRESIDENT JOHN F. KENNEDY",
    "RELEASED UNDER THE JOHN F. KENNEDY",
    "ASSASSINATION RECORDS COLLECTION ACT",
)


@dataclass
class AbbyyDocument:
    abbyy_doc_id: str
    source_filename: str
    source_path: str
    normalized_key: str
    title_guess: str
    release_batch: str
    raw_text: str
    raw_json: str
    source_repo: str


@dataclass
class AbbyyChunk:
    chunk_id: str
    abbyy_doc_id: str
    normalized_key: str
    chunk_order: int
    chunk_text: str
    chunk_chars: int
    token_estimate: int
    page_label: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def run(cmd: list[str], *, check: bool = True, capture: bool = False) -> subprocess.CompletedProcess:
    """Run a subprocess with consistent error handling."""
    print(f"$ {' '.join(cmd)}", file=sys.stderr)
    return subprocess.run(
        cmd,
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def ensure_repo(repo_dir: Path, *, clone: bool) -> str:
    """Clone the repo if needed, pull LFS blobs, return the commit SHA."""
    if clone:
        if repo_dir.exists() and any(repo_dir.iterdir()):
            print(f"[repo] using existing {repo_dir}", file=sys.stderr)
        else:
            repo_dir.parent.mkdir(parents=True, exist_ok=True)
            run(["git", "clone", "--depth", "1", ABBYY_REPO_URL, str(repo_dir)])
        run(["git", "-C", str(repo_dir), "lfs", "install", "--local"])
        run(["git", "-C", str(repo_dir), "lfs", "pull"])

    sha = run(
        ["git", "-C", str(repo_dir), "rev-parse", "HEAD"],
        capture=True,
    ).stdout.strip()
    return sha


def parse_filename(name: str) -> tuple[str, Optional[str]]:
    """Return (normalized_key, parenthetical_suffix_or_None)."""
    m = FILENAME_RE.match(name)
    if not m:
        return "", None
    return m.group("rif"), m.group("suffix")


def pdf_page_count(path: Path) -> int:
    try:
        out = run(["pdfinfo", str(path)], capture=True).stdout
        for line in out.splitlines():
            if line.startswith("Pages:"):
                return int(line.split(":", 1)[1].strip())
    except Exception:
        pass
    return 0


def extract_text(path: Path) -> str:
    try:
        out = run(
            ["pdftotext", "-layout", str(path), "-"],
            capture=True,
        ).stdout
        return out or ""
    except Exception as exc:  # pragma: no cover
        print(f"  [extract] {path.name}: {exc}", file=sys.stderr)
        return ""


def first_nonboilerplate_line(text: str, limit: int = 140) -> str:
    for raw in text.splitlines():
        line = raw.strip()
        if len(line) < 4:
            continue
        if any(frag in line.upper() for frag in BOILERPLATE_FRAGMENTS):
            continue
        # Skip lines that are mostly punctuation or a lone identifier
        if re.fullmatch(r"[\W_\s]+|\d{3}-\d{5}-\d{5}|10 A?\d{4,}_*,?", line):
            continue
        return line[:limit]
    return ""


def split_pages(text: str) -> list[str]:
    """Split pdftotext output on form-feed (\\x0c) page separators.

    pdftotext emits `\\x0c` between pages and often one trailing `\\x0c` at the
    end of the document. Returns one string per physical page (1-indexed by
    position). A document with no form-feeds yields a single-element list.
    """
    parts = text.split("\x0c")
    if parts and parts[-1] == "":
        parts.pop()
    return parts


def chunkify(text: str, budget: int = CHUNK_CHAR_BUDGET) -> Iterable[str]:
    """
    Split text into <=budget-char chunks at word boundaries. Preserves line
    breaks so OCR'd columns don't glom together. Emits nothing for text below
    MIN_CHUNK_CHARS after stripping.
    """
    norm = re.sub(r"[ \t]+", " ", text)
    norm = re.sub(r"\n{2,}", "\n\n", norm)
    cursor = 0
    n = len(norm)
    while cursor < n:
        end = min(cursor + budget, n)
        if end < n:
            # Walk back to the last whitespace so we don't cut mid-word.
            back = norm.rfind(" ", cursor, end)
            nl = norm.rfind("\n", cursor, end)
            break_at = max(back, nl)
            if break_at > cursor + 200:
                end = break_at
        chunk = norm[cursor:end].strip()
        if len(chunk) >= MIN_CHUNK_CHARS:
            yield chunk
        cursor = end


def iter_pdfs(data_dir: Path) -> Iterable[Path]:
    for entry in sorted(data_dir.iterdir()):
        if entry.is_file() and entry.suffix.lower() == ".pdf":
            yield entry


def list_pdfs_from_github() -> list[str]:
    """Return a sorted list of basenames (e.g. '104-10004-10156.pdf') from the ABBYY repo."""
    req = Request(GITHUB_TREE_API, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "jfk-research-center-ingest/1.0",
    })
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urlopen(req, timeout=60) as resp:
        payload = json.load(resp)
    if payload.get("truncated"):
        print(
            "[warn] GitHub tree response was truncated; set GITHUB_TOKEN to fetch full listing",
            file=sys.stderr,
        )
    names: list[str] = []
    for entry in payload.get("tree", []):
        path = entry.get("path", "")
        if path.startswith("Data/") and path.lower().endswith(".pdf") and entry.get("type") == "blob":
            names.append(path[len("Data/"):])
    names.sort()
    return names


def download_pdf_streaming(name: str, dest: Path, *, max_retries: int = 3) -> int:
    """Download one PDF from the LFS media URL. Returns byte length. Retries on transient errors."""
    url = f"{ABBYY_MEDIA_BASE}/{quote(name)}"
    last_exc: Optional[BaseException] = None
    for attempt in range(1, max_retries + 1):
        try:
            req = Request(url, headers={"User-Agent": "jfk-research-center-ingest/1.0"})
            with urlopen(req, timeout=120) as resp, dest.open("wb") as fd:
                total = 0
                while True:
                    buf = resp.read(1 << 16)
                    if not buf:
                        break
                    fd.write(buf)
                    total += len(buf)
            return total
        except Exception as exc:  # pragma: no cover
            last_exc = exc
            print(f"  [retry {attempt}/{max_retries}] {name}: {exc}", file=sys.stderr)
            time.sleep(min(2 ** attempt, 15))
    raise RuntimeError(f"failed to download {name}: {last_exc}")


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------


def _pdf_source_iter(
    *,
    mode: str,
    repo_dir: Optional[Path],
    limit: Optional[int],
) -> Iterator[tuple[str, Path, bool]]:
    """
    Yield (filename, pdf_path, is_temp) tuples.

    In 'clone' mode pdf_path points into the cloned repo and is_temp is False.
    In 'stream' mode each PDF is downloaded to a new temp file; caller is
    responsible for deleting it after processing.
    """
    if mode == "clone":
        assert repo_dir is not None
        data_dir = repo_dir / "Data"
        if not data_dir.exists():
            raise SystemExit(f"[error] expected {data_dir} to exist")
        for i, pdf in enumerate(iter_pdfs(data_dir)):
            if limit is not None and i >= limit:
                return
            yield (pdf.name, pdf, False)
        return

    if mode == "stream":
        names = list_pdfs_from_github()
        print(f"[stream] github listed {len(names)} PDFs", file=sys.stderr)
        if limit is not None:
            names = names[:limit]
        for name in names:
            fd, tmp_name = tempfile.mkstemp(prefix="abbyy-", suffix=".pdf")
            os.close(fd)
            tmp = Path(tmp_name)
            try:
                download_pdf_streaming(name, tmp)
                yield (name, tmp, True)
            except Exception as exc:
                tmp.unlink(missing_ok=True)
                print(f"  [skip] download failed: {name}: {exc}", file=sys.stderr)
                continue
        return

    raise ValueError(f"unknown pdf source mode: {mode!r}")


def process(
    *,
    mode: str,
    repo_dir: Optional[Path],
    out_dir: Path,
    release_batch: str,
    source_repo_sha: Optional[str],
    limit: Optional[int],
) -> tuple[int, int, int]:
    out_dir.mkdir(parents=True, exist_ok=True)
    docs_csv = out_dir / "abbyy_documents.csv"
    chunks_csv = out_dir / "abbyy_text_chunks.csv"

    n_docs = 0
    n_chunks = 0
    n_skipped = 0

    source_repo_label = (
        f"abbyy/JFK-OCR@{source_repo_sha[:12]}"
        if source_repo_sha
        else f"abbyy/JFK-OCR@{ABBYY_BRANCH}"
    )

    with (
        docs_csv.open("w", newline="") as fd_docs,
        chunks_csv.open("w", newline="") as fd_chunks,
    ):
        w_docs = csv.writer(fd_docs, quoting=csv.QUOTE_ALL)
        w_chunks = csv.writer(fd_chunks, quoting=csv.QUOTE_ALL)

        w_docs.writerow(
            [
                "abbyy_doc_id",
                "source_filename",
                "source_path",
                "normalized_key",
                "title_guess",
                "release_batch",
                "raw_text",
                "raw_json",
                "source_repo",
            ]
        )
        w_chunks.writerow(
            [
                "chunk_id",
                "abbyy_doc_id",
                "normalized_key",
                "chunk_order",
                "chunk_text",
                "chunk_chars",
                "token_estimate",
                "page_label",
            ]
        )

        for name, pdf_path, is_temp in _pdf_source_iter(
            mode=mode, repo_dir=repo_dir, limit=limit
        ):
            try:
                normalized_key, suffix = parse_filename(name)
                if not normalized_key:
                    n_skipped += 1
                    print(f"  [skip] unrecognized filename: {name}", file=sys.stderr)
                    continue

                abbyy_doc_id = (
                    normalized_key if not suffix else f"{normalized_key}__{suffix}"
                )

                if mode == "clone" and repo_dir is not None:
                    rel_path = str(pdf_path.relative_to(repo_dir))
                else:
                    rel_path = f"Data/{name}"

                page_count = pdf_page_count(pdf_path)
                pdf_bytes = pdf_path.stat().st_size
                raw_text = extract_text(pdf_path)
                title_guess = first_nonboilerplate_line(raw_text)

                raw_json = json.dumps(
                    {
                        "pdf_bytes": pdf_bytes,
                        "page_count": page_count,
                        "extraction_tool": "pdftotext -layout",
                        "sha1": hashlib.sha1(
                            raw_text.encode("utf-8"), usedforsecurity=False
                        ).hexdigest(),
                        "parenthetical_suffix": suffix,
                        "ingest_mode": mode,
                    },
                    separators=(",", ":"),
                )

                w_docs.writerow(
                    [
                        abbyy_doc_id,
                        name,
                        rel_path,
                        normalized_key,
                        title_guess,
                        release_batch,
                        raw_text,
                        raw_json,
                        source_repo_label,
                    ]
                )
                n_docs += 1

                order = 0
                for page_idx, page_text in enumerate(split_pages(raw_text), start=1):
                    for chunk in chunkify(page_text):
                        chunk_id = f"{abbyy_doc_id}-{order:04d}"
                        w_chunks.writerow(
                            [
                                chunk_id,
                                abbyy_doc_id,
                                normalized_key,
                                order,
                                chunk,
                                len(chunk),
                                max(1, len(chunk) // 4),
                                f"p. {page_idx}",
                            ]
                        )
                        order += 1
                        n_chunks += 1

                if n_docs % 100 == 0:
                    fd_docs.flush()
                    fd_chunks.flush()
                    print(
                        f"  [progress] {n_docs} docs, {n_chunks} chunks",
                        file=sys.stderr,
                    )
            finally:
                if is_temp:
                    try:
                        pdf_path.unlink(missing_ok=True)
                    except OSError:
                        pass

    print(
        f"[done] {n_docs} documents, {n_chunks} chunks, {n_skipped} skipped",
        file=sys.stderr,
    )
    print(f"       wrote {docs_csv}", file=sys.stderr)
    print(f"       wrote {chunks_csv}", file=sys.stderr)
    return n_docs, n_chunks, n_skipped


def bq_load(
    project: str,
    dataset: str,
    out_dir: Path,
) -> None:
    docs_csv = out_dir / "abbyy_documents.csv"
    chunks_csv = out_dir / "abbyy_text_chunks.csv"

    docs_schema = (
        "abbyy_doc_id:STRING,"
        "source_filename:STRING,"
        "source_path:STRING,"
        "normalized_key:STRING,"
        "title_guess:STRING,"
        "release_batch:STRING,"
        "raw_text:STRING,"
        "raw_json:STRING,"
        "source_repo:STRING"
    )
    chunks_schema = (
        "chunk_id:STRING,"
        "abbyy_doc_id:STRING,"
        "normalized_key:STRING,"
        "chunk_order:INTEGER,"
        "chunk_text:STRING,"
        "chunk_chars:INTEGER,"
        "token_estimate:INTEGER,"
        "page_label:STRING"
    )

    base_args = [
        "bq",
        "load",
        f"--project_id={project}",
        "--location=US",
        "--source_format=CSV",
        "--skip_leading_rows=1",
        "--allow_quoted_newlines",
        "--replace",
    ]

    run(
        [
            *base_args,
            f"{dataset}.abbyy_documents",
            str(docs_csv),
            docs_schema,
        ]
    )
    run(
        [
            *base_args,
            f"{dataset}.abbyy_text_chunks",
            str(chunks_csv),
            chunks_schema,
        ]
    )


def require(cmd: str) -> None:
    if shutil.which(cmd) is None:
        raise SystemExit(f"[error] required executable not found on PATH: {cmd}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    ap.add_argument(
        "--clone", action="store_true",
        help="Clone the repo + git lfs pull, then process local files. "
             "Default is streaming mode (disk-safe, no clone).",
    )
    ap.add_argument("--repo-dir", type=Path, default=None,
                    help="Local clone of abbyy/JFK-OCR (clone mode only)")
    ap.add_argument("--out-dir",  type=Path, required=True,
                    help="Directory for intermediate CSV outputs")
    ap.add_argument("--project",  default="jfk-vault",
                    help="GCP project id for bq load")
    ap.add_argument("--dataset",  default="jfk_staging",
                    help="BigQuery dataset for staging tables")
    ap.add_argument("--release-batch", default=RELEASE_BATCH_DEFAULT,
                    help="Logical release label written to each doc row")
    ap.add_argument("--limit", type=int, default=None,
                    help="Process at most N PDFs (useful for sanity checks)")
    ap.add_argument("--skip-load", action="store_true",
                    help="Write CSVs but don't call `bq load`")
    args = ap.parse_args()

    for dep in ("pdftotext", "pdfinfo"):
        require(dep)

    if args.clone:
        mode = "clone"
        if args.repo_dir is None:
            raise SystemExit("[error] --clone requires --repo-dir")
        for dep in ("git", "git-lfs"):
            require(dep)
        sha: Optional[str] = ensure_repo(args.repo_dir, clone=True)
    else:
        mode = "stream"
        sha = None
        if args.repo_dir is not None:
            print(
                "[info] --repo-dir ignored in streaming mode (no --clone flag)",
                file=sys.stderr,
            )

    n_docs, n_chunks, _ = process(
        mode=mode,
        repo_dir=args.repo_dir if args.clone else None,
        out_dir=args.out_dir,
        release_batch=args.release_batch,
        source_repo_sha=sha,
        limit=args.limit,
    )

    if not args.skip_load:
        if not shutil.which("bq"):
            raise SystemExit("[error] `bq` not found on PATH; use --skip-load")
        bq_load(args.project, args.dataset, args.out_dir)

    print(
        f"[summary] mode={mode} {n_docs} documents, {n_chunks} chunks -> "
        f"{args.project}:{args.dataset}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
