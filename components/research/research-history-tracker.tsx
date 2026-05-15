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
    addResearchHistoryItem(item);
  }, [item.type, item.sourceId, item.title, item.href, item.context]);

  return null;
}
