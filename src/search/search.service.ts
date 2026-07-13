import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, PipelineStage } from 'mongoose';
import { City, CityDocument } from '../cities/schemas/city.schema';
import { MediaType } from '../common/enums/media.enum';
import { ModerationStatus } from '../common/enums/moderation-status.enum';
import { accentInsensitivePattern } from '../common/utils/search.util';

type UnionWithPipeline = Extract<
  PipelineStage.UnionWith['$unionWith'],
  { coll: string }
>['pipeline'];

export interface SearchResultItem {
  type:
    | 'city'
    | 'touristSite'
    | 'historicalFigure'
    | 'story'
    | 'tradition'
    | 'event';
  id: string;
  title: string;
  description?: string;
  image?: string;
  city?: string;
  date?: Date;
  category?: string;
  tags?: string[];
}

/** Common row shape shared by the text and regex search paths. */
interface SearchRow {
  _id: { toString(): string };
  type: SearchResultItem['type'];
  ownerType: string;
  title: string;
  description?: string;
  tags?: string[];
  city?: { toString(): string };
  date?: Date;
  category?: string;
  score: number;
  createdAt?: Date;
}

/** One searched collection: its result type, fields and visibility rules. */
interface SearchBranch {
  model: string; // Mongoose model name — also the media ownerType
  type: SearchResultItem['type'];
  titleField: string;
  searchFields: string[];
  visibility: Record<string, unknown>;
}

const VISIBLE = { deleted: false };

/**
 * IMPORTANT — the visibility rules below are duplicated from each service's
 * `findAll` (notably `TouristSitesService.findAll`, the source of truth for
 * hiding pending / rejected submissions). If a moderation rule changes there,
 * it must be mirrored here or global search will leak or hide content.
 */
const BRANCHES: SearchBranch[] = [
  {
    model: City.name,
    type: 'city',
    titleField: 'name',
    searchFields: ['name', 'description', 'history', 'tags'],
    visibility: VISIBLE,
  },
  {
    model: 'TouristSite',
    type: 'touristSite',
    titleField: 'name',
    searchFields: ['name', 'description', 'history', 'tags'],
    visibility: {
      deleted: false,
      status: { $nin: [ModerationStatus.PENDING, ModerationStatus.REJECTED] },
    },
  },
  {
    model: 'HistoricalFigure',
    type: 'historicalFigure',
    titleField: 'name',
    searchFields: ['name', 'description', 'biography', 'tags'],
    visibility: VISIBLE,
  },
  {
    model: 'Story',
    type: 'story',
    titleField: 'title',
    searchFields: ['title', 'description', 'body', 'tags'],
    visibility: VISIBLE,
  },
  {
    model: 'Tradition',
    type: 'tradition',
    titleField: 'title',
    searchFields: ['title', 'description', 'origin', 'tags'],
    visibility: VISIBLE,
  },
  {
    model: 'Event',
    type: 'event',
    titleField: 'title',
    searchFields: ['title', 'description', 'origin', 'tags'],
    visibility: VISIBLE,
  },
];

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(City.name) private readonly cityModel: Model<CityDocument>,
    // Used to resolve models / collection names by name, so the search never
    // hardcodes Mongoose's pluralization nor depends on six modules.
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * Global search across every public content type, as a single
   * relevance-ranked list.
   *
   * Primary path: the weighted French `$text` indexes declared on each schema
   * (fast, diacritic- and case-insensitive, French stemming) — queried per
   * collection because MongoDB forbids `$text` inside `$unionWith` pipelines.
   * Fallback when `$text` finds nothing (e.g. partial words like "ouid" while
   * typing): one case-insensitive substring `$unionWith` aggregation.
   */
  async search(q: string, limit = 20) {
    let rows: SearchRow[];
    try {
      rows = await this.textSearch(q, limit);
    } catch {
      // Text indexes may not be built yet (fresh database): degrade to regex.
      rows = [];
    }
    if (rows.length === 0) {
      rows = await this.regexSearch(q, limit);
    }

    const thumbnails = await this.thumbnailsFor(rows);
    return {
      query: q,
      results: rows.map(
        (row): SearchResultItem => ({
          type: row.type,
          id: row._id.toString(),
          title: row.title,
          description: row.description,
          image: thumbnails.get(row._id.toString()),
          city: row.city?.toString(),
          date: row.date,
          category: row.category,
          tags: row.tags,
        }),
      ),
    };
  }

  /** Index-backed search: one `$text` query per collection, merged by score. */
  private async textSearch(q: string, limit: number): Promise<SearchRow[]> {
    const perBranch = await Promise.all(
      BRANCHES.map(async (branch) => {
        const docs = await this.model(branch.model)
          .find(
            { ...branch.visibility, $text: { $search: q } },
            { score: { $meta: 'textScore' } },
          )
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .lean<Record<string, unknown>[]>()
          .exec();
        return docs.map((doc) => this.toRow(branch, doc));
      }),
    );
    return perBranch
      .flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Substring fallback: one `$unionWith` aggregation over the six collections
   * with a case- and accent-insensitive literal regex, title matches ranked
   * first.
   */
  private async regexSearch(q: string, limit: number): Promise<SearchRow[]> {
    const pattern = accentInsensitivePattern(q);
    const regex = new RegExp(pattern, 'i');

    const branchPipeline = (branch: SearchBranch) => [
      {
        $match: {
          ...branch.visibility,
          $or: branch.searchFields.map((field) => ({ [field]: regex })),
        },
      },
      {
        $project: {
          _id: 1,
          type: { $literal: branch.type },
          ownerType: { $literal: branch.model },
          title: `$${branch.titleField}`,
          description: 1,
          tags: 1,
          city: 1,
          date: 1,
          category: 1,
          createdAt: 1,
          score: {
            $cond: [
              {
                $regexMatch: {
                  input: { $ifNull: [`$${branch.titleField}`, ''] },
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
    ];

    const [first, ...rest] = BRANCHES;
    const pipeline: PipelineStage[] = [
      ...(branchPipeline(first) as PipelineStage[]),
      ...rest.map(
        (branch): PipelineStage => ({
          $unionWith: {
            coll: this.collectionName(branch.model),
            pipeline: branchPipeline(branch) as UnionWithPipeline,
          },
        }),
      ),
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: limit },
    ];

    return this.cityModel.aggregate<SearchRow>(pipeline).exec();
  }

  private toRow(branch: SearchBranch, doc: Record<string, unknown>): SearchRow {
    return {
      _id: doc._id as SearchRow['_id'],
      type: branch.type,
      ownerType: branch.model,
      title: doc[branch.titleField] as string,
      description: doc.description as string | undefined,
      tags: doc.tags as string[] | undefined,
      city: doc.city as SearchRow['city'],
      date: doc.date as Date | undefined,
      category: doc.category as string | undefined,
      score: (doc.score as number | undefined) ?? 1,
    };
  }

  /** First non-deleted image media per result, keyed by result id. */
  private async thumbnailsFor(
    rows: SearchRow[],
  ): Promise<Map<string, string>> {
    const thumbnails = new Map<string, string>();
    if (rows.length === 0) {
      return thumbnails;
    }
    const media = await this.model('Media')
      .find({
        deleted: false,
        type: MediaType.IMAGE,
        owner: { $in: rows.map((row) => row._id) },
      })
      .sort({ createdAt: 1 })
      .lean<{ owner: { toString(): string }; url: string }[]>()
      .exec();
    for (const item of media) {
      const key = item.owner.toString();
      if (!thumbnails.has(key)) {
        thumbnails.set(key, item.url);
      }
    }
    return thumbnails;
  }

  private model(name: string): Model<unknown> {
    return this.connection.models[name] as Model<unknown>;
  }

  private collectionName(model: string): string {
    return this.connection.models[model].collection.name;
  }
}
