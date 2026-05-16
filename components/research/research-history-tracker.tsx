"use client";

import { useEffect } from "react";
import {
  addResearchHistoryItem,
  type ResearchHistoryInput,
} from "@/lib/research-history";

export function ResearchHistoryTracker({
  item,
}: {
  item: ResearchHistoryInput;
}) {
  useEffect(() => {
    try {
      addResearchHistoryItem(item);
    } catch {
      // History is best-effort local state; invalid page metadata must not affect browsing.
    }
  }, [item.type, item.sourceId, item.title, item.href, item.context]);

  return null;
}
