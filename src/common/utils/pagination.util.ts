import { Model, PopulateOptions, SortOrder } from 'mongoose';

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
  sort?: Record<string, SortOrder>;
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
    .find(filter)
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
