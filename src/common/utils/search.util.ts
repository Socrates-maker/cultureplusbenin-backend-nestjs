/** Escape user input so it is treated as a literal inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case-insensitive `$or` regex filter over the given fields for a free
 * text search term. Returns `undefined` when the term is empty so callers can
 * skip adding it to the query.
 */
export function buildSearchFilter(
  search: string | undefined,
  fields: string[],
): Record<string, unknown> | undefined {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }
  const regex = new RegExp(escapeRegExp(term), 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
}
