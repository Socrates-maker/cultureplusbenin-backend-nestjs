import { ForbiddenError, subject } from '@casl/ability';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CitiesService } from '../cities/cities.service';
import { CaslAbilityFactory, RequestUser } from '../casl/casl-ability.factory';
import { Action } from '../casl/action.enum';
import { buildSearchFilter } from '../common/utils/search.util';
import { buildTagsFilter } from '../common/utils/tags.util';
import {
  PageOptions,
  Paginated,
  paginate,
} from '../common/utils/pagination.util';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event, EventDocument } from './schemas/event.schema';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
    private readonly citiesService: CitiesService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async create(dto: CreateEventDto, user: RequestUser): Promise<EventDocument> {
    // Ensure the referenced city exists before linking the event to it.
    if (dto.city) {
      await this.citiesService.findById(dto.city);
    }
    const event = new this.eventModel({ ...dto, createdBy: user.userId });
    return event.save();
  }

  /** Public listing, filterable by city, tags and free text. */
  findAll(
    filter: {
      city?: string;
      search?: string;
      tags?: string;
    } = {},
    pagination: PageOptions = {},
  ): Promise<Paginated<EventDocument>> {
    const query: Record<string, unknown> = { deleted: false };
    if (filter.city) {
      query.city = filter.city;
    }
    const searchFilter = buildSearchFilter(filter.search, [
      'title',
      'description',
      'origin',
      'tags',
    ]);
    if (searchFilter) {
      Object.assign(query, searchFilter);
    }
    const tagsFilter = buildTagsFilter(filter.tags);
    if (tagsFilter) {
      Object.assign(query, tagsFilter);
    }
    return paginate<EventDocument>(this.eventModel, query, pagination, {
      populate: ['media', 'galleries'],
      sort: { date: 1 },
    });
  }

  /** Distinct tags across visible events (filter UIs / autocomplete). */
  async listTags(): Promise<string[]> {
    const tags = await this.eventModel
      .distinct('tags', { deleted: false })
      .exec();
    return (tags as string[]).sort();
  }

  async findById(id: string): Promise<EventDocument> {
    const event = await this.eventModel
      .findOne({ _id: id, deleted: false })
      .populate('media')
      .populate({ path: 'galleries', populate: { path: 'media' } })
      .exec();
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    user: RequestUser,
  ): Promise<EventDocument> {
    const event = await this.findById(id);
    this.assertCan(Action.Update, event, user);
    if (dto.city) {
      await this.citiesService.findById(dto.city);
    }
    event.set(dto);
    return event.save();
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const event = await this.findById(id);
    this.assertCan(Action.Delete, event, user);
    event.deleted = true;
    await event.save();
  }

  /** Record-level authorization: editors may only touch their own events. */
  private assertCan(action: Action, event: EventDocument, user: RequestUser) {
    const ability = this.caslAbilityFactory.createForUser(user);
    try {
      ForbiddenError.from(ability).throwUnlessCan(
        action,
        subject('Event', {
          ...event.toObject(),
          createdBy: event.createdBy?.toString(),
        }),
      );
    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }
}
