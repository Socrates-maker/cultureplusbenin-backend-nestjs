/**
 * Normalize free-form tags so they compare reliably: trimmed, lowercased,
 * empties dropped and duplicates removed. Returns `undefined` when the input
 * is absent so optional DTO fields stay absent.
 */
export function normalizeTags(
  tags: string[] | undefined,
): string[] | undefined {
  if (!tags) {
    return undefined;
  }
  const cleaned = tags
    .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
    .filter(Boolean);
  return [...new Set(cleaned)];
}

/**
 * Build a `$in` filter from the comma-separated `tags` query param (matches
 * documents carrying at least one of the tags). Returns `undefined` when the
 * param is empty so callers can skip adding it to the query.
 */
export function buildTagsFilter(
  tagsParam: string | undefined,
): Record<string, unknown> | undefined {
  const tags = normalizeTags(tagsParam?.split(','));
  if (!tags?.length) {
    return undefined;
  }
  return { tags: { $in: tags } };
}
