"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  formatResearchBriefMarkdown,
  formatResearchBriefPlainText,
  normalizeResearchBriefItems,
} from "@/lib/research-brief";
import {
  listSavedResearchItems,
  savedResearchTypeLabel,
  type SavedResearchItem,
} from "@/lib/saved-research";
import styles from "./research-brief-builder.module.css";

const draftStorageKey = "jfkrc-research-brief-draft-v1";

type BriefDraft = {
  title: string;
  question: string;
  notes: string;
  orderedIds: string[];
  selectedIds: string[];
};

export function ResearchBriefBuilder() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<SavedResearchItem[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("JFK research brief");
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setMounted(true);
    const saved = listSavedResearchItems();
    const draft = readDraft();
    setItems(saved);
    setOrderedIds(mergeOrderedIds(saved, draft?.orderedIds ?? []));
    setSelectedIds(
      new Set(
        filterExistingIds(
          saved,
          draft?.selectedIds && draft.selectedIds.length > 0
            ? draft.selectedIds
            : saved.map((item) => item.id),
        ),
      ),
    );
    if (draft) {
      setTitle(draft.title || "JFK research brief");
      setQuestion(draft.question);
      setNotes(draft.notes);
    }

    const sync = () => {
      const next = listSavedResearchItems();
      setItems(next);
      setOrderedIds((current) => mergeOrderedIds(next, current));
      setSelectedIds((current) => {
        const nextIds = new Set(next.map((item) => item.id));
        return new Set([...current].filter((id) => nextIds.has(id)));
      });
    };
    window.addEventListener("jfkrc:saved-research-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("jfkrc:saved-research-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const orderedItems = useMemo(
    () => orderItems(items, orderedIds),
    [items, orderedIds],
  );
  const selectedItems = useMemo(
    () => orderedItems.filter((item) => selectedIds.has(item.id)),
    [orderedItems, selectedIds],
  );
  const briefItems = useMemo(
    () => normalizeResearchBriefItems(selectedItems),
    [selectedItems],
  );
  const markdown = useMemo(
    () =>
      formatResearchBriefMarkdown({
        title,
        question,
        notes,
        items: selectedItems,
      }),
    [title, question, notes, selectedItems],
  );
  const plainText = useMemo(
    () =>
      formatResearchBriefPlainText({
        title,
        question,
        notes,
        items: selectedItems,
      }),
    [title, question, notes, selectedItems],
  );

  useEffect(() => {
    if (!mounted) return;
    writeDraft({
      title,
      question,
      notes,
      orderedIds,
      selectedIds: [...selectedIds],
    });
  }, [mounted, title, question, notes, orderedIds, selectedIds]);

  const hasItems = mounted && orderedItems.length > 0;

  return (
    <div className={`container ${styles.shell}`}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden>/</span>
        <span>Research brief</span>
      </nav>

      <header className={styles.header}>
        <div>
          <div className="eyebrow">Research workspace</div>
          <h1 className={styles.title}>Build a source-backed brief.</h1>
          <p className={styles.lede}>
            Turn saved tray items into an ordered working brief with source
            links, notes, and export-ready references.
          </p>
        </div>
        <aside className={styles.stats} aria-label="Brief source counts">
          <div className={styles.stat}>
            <strong>{mounted ? orderedItems.length : 0}</strong>
            <span>Saved</span>
          </div>
          <div className={styles.stat}>
            <strong>{mounted ? briefItems.length : 0}</strong>
            <span>Selected</span>
          </div>
        </aside>
      </header>

      {!hasItems ? (
        <EmptyState />
      ) : (
        <div className={styles.workspace}>
          <section className={styles.panel} aria-labelledby="brief-setup-title">
            <div className={styles.panelHeader}>
              <div>
                <div className="eyebrow">Draft</div>
                <h2 id="brief-setup-title">Brief setup</h2>
              </div>
            </div>
            <div className={styles.fields}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Question</span>
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What does this source stack help answer?"
                />
              </label>
              <label className={styles.field}>
                <span>Working notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add scope, cautions, or next checks."
                />
              </label>
            </div>

            <div style={{ marginTop: 22 }}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.listLabel}>Sources</div>
                </div>
                <div className={styles.sourceToolbar}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() =>
                      setSelectedIds(new Set(orderedItems.map((item) => item.id)))
                    }
                  >
                    Include all
                  </button>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <ul className={styles.sourceList}>
                {orderedItems.map((item, index) => {
                  const selected = selectedIds.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className={styles.sourceItem}
                      data-selected={String(selected)}
                    >
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        aria-label={`Include ${item.title}`}
                        checked={selected}
                        onChange={() => toggleSelected(item.id, setSelectedIds)}
                      />
                      <div className={styles.sourceBody}>
                        <div className={styles.sourceMeta}>
                          <span className={styles.sourceType}>
                            {savedResearchTypeLabel(item.type)}
                          </span>
                          <span>{formatSavedAt(item.savedAt)}</span>
                        </div>
                        <Link href={item.href} className={styles.sourceTitle}>
                          {item.title}
                        </Link>
                        {item.context ? (
                          <div className={styles.sourceContext}>{item.context}</div>
                        ) : null}
                        <div className={styles.sourceActions}>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => moveItem(item.id, -1, setOrderedIds)}
                            disabled={index === 0}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => moveItem(item.id, 1, setOrderedIds)}
                            disabled={index === orderedItems.length - 1}
                          >
                            Move down
                          </button>
                          <button
                            type="button"
                            className={styles.dangerButton}
                            onClick={() =>
                              setSelectedIds((current) => {
                                const next = new Set(current);
                                next.delete(item.id);
                                return next;
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className={styles.previewPanel} aria-labelledby="brief-preview-title">
            <div className={styles.previewHeader}>
              <div>
                <div className="eyebrow">Export</div>
                <h2 id="brief-preview-title">Markdown preview</h2>
              </div>
              <div className={styles.exportToolbar}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => copyText(markdown, "Markdown copied.", setStatus)}
                  disabled={briefItems.length === 0}
                >
                  Copy Markdown
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => copyText(plainText, "Plain text copied.", setStatus)}
                  disabled={briefItems.length === 0}
                >
                  Copy text
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => downloadMarkdown(title, markdown)}
                  disabled={briefItems.length === 0}
                >
                  Download
                </button>
              </div>
            </div>
            <textarea
              className={styles.preview}
              value={markdown}
              readOnly
              aria-label="Generated Markdown brief"
            />
            <div className={styles.status} aria-live="polite" aria-atomic="true">
              {status}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <section className={styles.empty} aria-labelledby="empty-brief-title">
      <div className="eyebrow">No saved sources</div>
      <h2 id="empty-brief-title">Save a few records first.</h2>
      <p>
        The brief builder reads from the local research tray, so documents,
        media, entities, evidence, topics, timeline events, and questions can
        become source entries here.
      </p>
      <div className={styles.trayActions}>
        <Link href="/search" className={styles.button}>
          Search records
        </Link>
        <Link href="/research-paths" className={styles.secondaryButton}>
          Open research paths
        </Link>
      </div>
    </section>
  );
}

function orderItems(items: SavedResearchItem[], orderedIds: string[]) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const ordered = orderedIds
    .map((id) => itemById.get(id))
    .filter((item): item is SavedResearchItem => Boolean(item));
  const placed = new Set(ordered.map((item) => item.id));
  return [
    ...ordered,
    ...items.filter((item) => !placed.has(item.id)),
  ];
}

function mergeOrderedIds(items: SavedResearchItem[], orderedIds: string[]) {
  return orderItems(items, orderedIds).map((item) => item.id);
}

function filterExistingIds(items: SavedResearchItem[], ids: string[]) {
  const existing = new Set(items.map((item) => item.id));
  return ids.filter((id) => existing.has(id));
}

function toggleSelected(
  id: string,
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>,
) {
  setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
}

function moveItem(
  id: string,
  delta: -1 | 1,
  setOrderedIds: Dispatch<SetStateAction<string[]>>,
) {
  setOrderedIds((current) => {
    const index = current.indexOf(id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
    const next = [...current];
    const [item] = next.splice(index, 1);
    if (!item) return current;
    next.splice(nextIndex, 0, item);
    return next;
  });
}

async function copyText(
  text: string,
  successMessage: string,
  setStatus: (value: string) => void,
) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage);
  } catch {
    setStatus("Copy failed. Select the preview text instead.");
  }
}

function downloadMarkdown(title: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(title || "research-brief")}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readDraft(): BriefDraft | null {
  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BriefDraft>;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "JFK research brief",
      question: typeof parsed.question === "string" ? parsed.question : "",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      orderedIds: Array.isArray(parsed.orderedIds)
        ? parsed.orderedIds.filter((id): id is string => typeof id === "string")
        : [],
      selectedIds: Array.isArray(parsed.selectedIds)
        ? parsed.selectedIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function writeDraft(draft: BriefDraft) {
  try {
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  } catch {
    // Local-only draft state should never block the builder.
  }
}

function formatSavedAt(savedAt: number): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.valueOf())) return "Saved source";
  return date.toISOString().slice(0, 10);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "research-brief";
}
