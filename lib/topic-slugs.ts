/**
 * Topics that exist in the catalog but have no jfk_mvp.* table.
 * physical-evidence redirects to /evidence and its data lives in
 * jfk_curated.physical_evidence, so topic-detail queries must skip it.
 */
export const REDIRECT_ONLY_TOPIC_SLUGS: readonly string[] = ["physical-evidence"];

export function isRedirectOnlyTopicSlug(slug: string): boolean {
  return REDIRECT_ONLY_TOPIC_SLUGS.includes(slug);
}
