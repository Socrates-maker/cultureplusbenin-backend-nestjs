import { Model, PopulateOptions, SortOrder } from 'mongoose';
import { accentInsensitivePattern, buildSearchFilter } from './search.util';

/** Uniform envelope returned by every paginated list endpoint. */
export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface PageOptions {
  page?: number;
  limit?: number;
}

interface PaginateQueryOptions {
  populate?: (string | PopulateOptions)[];
  sort?: Record<string, SortOrder | { $meta: string }>;
  projection?: Record<string, unknown>;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Run a filtered `find` alongside `countDocuments` and wrap the result in the
 * shared `{ data, page, limit, total }` envelope. Sorts by `createdAt` (all
 * schemas enable timestamps) so pages stay stable across requests; out of
 * range values are clamped to page >= 1 and 1 <= limit <= 100.
 *
 * Call with the hydrated document type explicitly —
 * `paginate<CityDocument>(this.cityModel, ...)` — mongoose's generics
 * otherwise infer the raw schema class instead of the document type.
 */
export async function paginate<TDoc>(
  model: Model<TDoc>,
  filter: Record<string, unknown>,
  pageOptions: PageOptions = {},
  options: PaginateQueryOptions = {},
): Promise<Paginated<TDoc>> {
  const page = Math.max(1, Number(pageOptions.page) || 1);
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, Number(pageOptions.limit) || DEFAULT_LIMIT),
  );

  let query = model
    .find(filter, options.projection)
    .sort(options.sort ?? { createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  if (options.populate?.length) {
    query = query.populate(options.populate) as typeof query;
  }

  const [data, total] = await Promise.all([
    query.exec() as unknown as Promise<TDoc[]>,
    model.countDocuments(filter).exec(),
  ]);

  return { data, page, limit, total };
}

/**
 * `paginate` with an optional free-text search, using the same two-stage
 * strategy as the global `/search` endpoint so section searches are equally
 * smart: the collection's weighted French `$text` index first (accent- and
 * case-insensitive, stemming, relevance-sorted), then an accent-insensitive
 * substring regex over `searchFields` when `$text` finds nothing (partial
 * words) or the index is not built yet. The fallback ranks documents whose
 * title (`searchFields[0]`) matches ahead of body-only matches, then most
 * recent first. Without a search term this is a plain `paginate` call.
 */
export async function paginateWithSearch<TDoc>(
  model: Model<TDoc>,
  baseFilter: Record<string, unknown>,
  search: string | undefined,
  searchFields: string[],
  pageOptions: PageOptions = {},
  options: PaginateQueryOptions = {},
): Promise<Paginated<TDoc>> {
  const term = search?.trim();
  if (!term) {
    return paginate(model, baseFilter, pageOptions, options);
  }

  try {
    const byText = await paginate(
      model,
      { ...baseFilter, $text: { $search: term } },
      pageOptions,
      {
        ...options,
        sort: { score: { $meta: 'textScore' } },
        projection: { score: { $meta: 'textScore' } },
      },
    );
    if (byText.total > 0) {
      return byText;
    }
  } catch {
    // Text index not built yet (fresh database) — use the regex path below.
  }

  return regexSearchPage(model, baseFilter, term, searchFields, pageOptions, options);
}

/**
 * Regex fallback with relevance ranking. `find()` cannot sort by a computed
 * score, so the ranked page of ids comes from a small aggregation, then the
 * documents are fetched with `find` to keep populate (virtuals) working.
 */
async function regexSearchPage<TDoc>(
  model: Model<TDoc>,
  baseFilter: Record<string, unknown>,
  term: string,
  searchFields: string[],
  pageOptions: PageOptions,
  options: PaginateQueryOptions,
): Promise<Paginated<TDoc>> {
  const page = Math.max(1, Number(pageOptions.page) || 1);
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, Number(pageOptions.limit) || DEFAULT_LIMIT),
  );

  const filter = { ...baseFilter, ...buildSearchFilter(term, searchFields) };
  const titleField = searchFields[0];
  const pattern = accentInsensitivePattern(term);

  const [idRows, total] = await Promise.all([
    model
      .aggregate<{ _id: unknown }>([
        { $match: filter },
        {
          $addFields: {
            _searchScore: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: [`$${titleField}`, ''] },
                    regex: pattern,
                    options: 'i',
                  },
                },
                2,
                1,
              ],
            },
          },
        },
        { $sort: { _searchScore: -1, createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { _id: 1 } },
      ])
      .exec(),
    model.countDocuments(filter).exec(),
  ]);

  const ids = idRows.map((row) => row._id);
  let query = model.find({ _id: { $in: ids } });
  if (options.populate?.length) {
    query = query.populate(options.populate) as typeof query;
  }
  const docs = (await query.exec()) as unknown as (TDoc & {
    _id: { toString(): string };
  })[];

  // `$in` does not preserve order: restore the ranked order of the id page.
  const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));
  const data = ids
    .map((id) => byId.get(String(id)))
    .filter((doc): doc is TDoc & { _id: { toString(): string } } => !!doc);

  return { data, page, limit, total };
}
