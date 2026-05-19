import type {
  OpenQuestionStatus,
  OpenQuestionThread,
  OpenQuestionsTopicResponse,
} from "./api-types";
import { tensionOrder } from "./constants";

export type TensionMapThread = {
  id: string;
  topicSlug: string;
  topicTitle: string;
  topicHref: string;
  question: string;
  summary: string | null;
  tensionType: string;
  status: OpenQuestionStatus;
  supportingDocIds: string[];
};

export type TensionMapGroup = {
  tensionType: string;
  threadCount: number;
  topicCount: number;
  documentCount: number;
  statusCounts: Record<OpenQuestionStatus, number>;
  threads: TensionMapThread[];
};

const knownTensionRank = new Map<string, number>(
  tensionOrder.map((type, index) => [type, index]),
);

const statusRank: Record<OpenQuestionStatus, number> = {
  open: 0,
  partially_resolved: 1,
  resolved: 2,
};

/** Groups open-question threads into tension buckets for the public tension map. */
export function buildTensionMap(
  topics: readonly OpenQuestionsTopicResponse[],
): TensionMapGroup[] {
  const groups = new Map<string, TensionMapThread[]>();

  for (const topic of topics) {
    for (const thread of topic.threads) {
      const tensionType = normalizeTensionType(thread.tensionType);
      const item = mapThread(topic, thread, tensionType);
      const list = groups.get(tensionType) ?? [];
      list.push(item);
      groups.set(tensionType, list);
    }
  }

  return Array.from(groups.entries())
    .map(([tensionType, threads]) => buildGroup(tensionType, threads))
    .sort(compareGroups);
}

export function normalizeTensionType(type: string | null | undefined): string {
  const normalized = type?.trim().toLowerCase();
  if (!normalized) return "other";
  return knownTensionRank.has(normalized) ? normalized : "other";
}

function mapThread(
  topic: OpenQuestionsTopicResponse,
  thread: OpenQuestionThread,
  tensionType: string,
): TensionMapThread {
  return {
    id: thread.id,
    topicSlug: topic.slug,
    topicTitle: topic.title,
    topicHref: `/open-questions/${encodeURIComponent(topic.slug)}`,
    question: thread.question,
    summary: thread.summary,
    tensionType,
    status: thread.status,
    supportingDocIds: Array.from(new Set(thread.supportingDocIds)),
  };
}

function buildGroup(
  tensionType: string,
  threads: TensionMapThread[],
): TensionMapGroup {
  const topicSlugs = new Set<string>();
  const documentIds = new Set<string>();
  const statusCounts: Record<OpenQuestionStatus, number> = {
    open: 0,
    partially_resolved: 0,
    resolved: 0,
  };

  for (const thread of threads) {
    topicSlugs.add(thread.topicSlug);
    statusCounts[thread.status] += 1;
    for (const id of thread.supportingDocIds) documentIds.add(id);
  }

  return {
    tensionType,
    threadCount: threads.length,
    topicCount: topicSlugs.size,
    documentCount: documentIds.size,
    statusCounts,
    threads: [...threads].sort(compareThreads),
  };
}

function compareGroups(a: TensionMapGroup, b: TensionMapGroup): number {
  const rankA = knownTensionRank.get(a.tensionType) ?? Number.MAX_SAFE_INTEGER;
  const rankB = knownTensionRank.get(b.tensionType) ?? Number.MAX_SAFE_INTEGER;
  return (
    rankA - rankB ||
    b.threadCount - a.threadCount ||
    a.tensionType.localeCompare(b.tensionType)
  );
}

function compareThreads(a: TensionMapThread, b: TensionMapThread): number {
  return (
    statusRank[a.status] - statusRank[b.status] ||
    b.supportingDocIds.length - a.supportingDocIds.length ||
    a.topicTitle.localeCompare(b.topicTitle) ||
    a.question.localeCompare(b.question)
  );
}
