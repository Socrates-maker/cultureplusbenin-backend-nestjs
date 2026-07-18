/** Escape user input so it is treated as a literal inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Character classes so an unaccented letter matches its accented variants
// (and vice versa, since the search term is folded first). Case is handled
// by the regex 'i' flag.
const ACCENT_CLASSES: Record<string, string> = {
  a: '[aàáâãä]',
  c: '[cç]',
  e: '[eèéêë]',
  i: '[iìíîï]',
  n: '[nñ]',
  o: '[oòóôõö]',
  u: '[uùúûü]',
  y: '[yýÿ]',
};

/**
 * Build a regex pattern that matches the term regardless of accents:
 * "behan" and "béhan" both match "Béhanzin". The input is treated literally.
 */
export function accentInsensitivePattern(term: string): string {
  // Fold the query so an accented input also matches unaccented content.
  const folded = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return [...folded]
    .map((char) => ACCENT_CLASSES[char.toLowerCase()] ?? escapeRegExp(char))
    .join('');
}

/**
 * Build a case- and accent-insensitive `$or` regex filter over the given
 * fields for a free text search term. Returns `undefined` when the term is
 * empty so callers can skip adding it to the query.
 */
export function buildSearchFilter(
  search: string | undefined,
  fields: string[],
): Record<string, unknown> | undefined {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }
  const regex = new RegExp(accentInsensitivePattern(term), 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
}
