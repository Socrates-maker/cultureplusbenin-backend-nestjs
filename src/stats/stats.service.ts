import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { MediaType } from '../common/enums/media.enum';
import { ModerationStatus } from '../common/enums/moderation-status.enum';

export interface PlatformStats {
  media: Record<MediaType, number>;
  content: {
    cities: number;
    touristSites: number;
    historicalFigures: number;
    stories: number;
    traditions: number;
    events: number;
    testimonials: number;
  };
}

const VISIBLE = { deleted: false };

// Moderated collections hide pending / rejected submissions, mirroring
// `TouristSitesService.findAll` and `TestimonialsService.findAll` (missing
// status counts as visible, so no data migration is required).
const MODERATED_VISIBLE = {
  deleted: false,
  status: { $nin: [ModerationStatus.PENDING, ModerationStatus.REJECTED] },
};

/** Content collections counted, keyed by response field. */
const CONTENT_BRANCHES: {
  key: keyof PlatformStats['content'];
  model: string;
  visibility: Record<string, unknown>;
}[] = [
  { key: 'cities', model: 'City', visibility: VISIBLE },
  { key: 'touristSites', model: 'TouristSite', visibility: MODERATED_VISIBLE },
  { key: 'historicalFigures', model: 'HistoricalFigure', visibility: VISIBLE },
  { key: 'stories', model: 'Story', visibility: VISIBLE },
  { key: 'traditions', model: 'Tradition', visibility: VISIBLE },
  { key: 'events', model: 'Event', visibility: VISIBLE },
  { key: 'testimonials', model: 'Testimonial', visibility: MODERATED_VISIBLE },
];

@Injectable()
export class StatsService {
  constructor(
    // Models are resolved by name so this module doesn't depend on the eight
    // feature modules (same approach as SearchService).
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async getStats(): Promise<PlatformStats> {
    const media = this.model('Media');
    const [mediaCounts, contentCounts] = await Promise.all([
      Promise.all(
        Object.values(MediaType).map(async (type) => ({
          type,
          count: await media.countDocuments({ deleted: false, type }),
        })),
      ),
      Promise.all(
        CONTENT_BRANCHES.map(async (branch) => ({
          key: branch.key,
          count: await this.model(branch.model).countDocuments(
            branch.visibility,
          ),
        })),
      ),
    ]);

    return {
      media: Object.fromEntries(
        mediaCounts.map(({ type, count }) => [type, count]),
      ) as PlatformStats['media'],
      content: Object.fromEntries(
        contentCounts.map(({ key, count }) => [key, count]),
      ) as PlatformStats['content'],
    };
  }

  private model(name: string): Model<unknown> {
    return this.connection.models[name] as Model<unknown>;
  }
}
