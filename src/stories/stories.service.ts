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
import { StoryCategory } from '../common/enums/story.enum';
import { buildSearchFilter } from '../common/utils/search.util';
import { buildTagsFilter } from '../common/utils/tags.util';
import {
  PageOptions,
  Paginated,
  paginate,
} from '../common/utils/pagination.util';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { Story, StoryDocument } from './schemas/story.schema';

@Injectable()
export class StoriesService {
  constructor(
    @InjectModel(Story.name)
    private readonly storyModel: Model<StoryDocument>,
    private readonly citiesService: CitiesService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async create(dto: CreateStoryDto, user: RequestUser): Promise<StoryDocument> {
    // Ensure the referenced city exists before linking the story to it.
    if (dto.city) {
      await this.citiesService.findById(dto.city);
    }
    const story = new this.storyModel({ ...dto, createdBy: user.userId });
    return story.save();
  }

  /** Public listing, filterable by category, city, tags and free text. */
  findAll(
    filter: {
      category?: StoryCategory;
      city?: string;
      search?: string;
      tags?: string;
    } = {},
    pagination: PageOptions = {},
  ): Promise<Paginated<StoryDocument>> {
    const query: Record<string, unknown> = { deleted: false };
    if (filter.category) {
      query.category = filter.category;
    }
    if (filter.city) {
      query.city = filter.city;
    }
    const searchFilter = buildSearchFilter(filter.search, [
      'title',
      'description',
      'body',
      'tags',
    ]);
    if (searchFilter) {
      Object.assign(query, searchFilter);
    }
    const tagsFilter = buildTagsFilter(filter.tags);
    if (tagsFilter) {
      Object.assign(query, tagsFilter);
    }
    return paginate<StoryDocument>(this.storyModel, query, pagination, {
      populate: ['media', 'galleries'],
    });
  }

  /** Distinct tags across visible stories (filter UIs / autocomplete). */
  async listTags(): Promise<string[]> {
    const tags = await this.storyModel
      .distinct('tags', { deleted: false })
      .exec();
    return (tags as string[]).sort();
  }

  async findById(id: string): Promise<StoryDocument> {
    const story = await this.storyModel
      .findOne({ _id: id, deleted: false })
      .populate('media')
      .populate({ path: 'galleries', populate: { path: 'media' } })
      .exec();
    if (!story) {
      throw new NotFoundException('Story not found');
    }
    return story;
  }

  async update(
    id: string,
    dto: UpdateStoryDto,
    user: RequestUser,
  ): Promise<StoryDocument> {
    const story = await this.findById(id);
    this.assertCan(Action.Update, story, user);
    if (dto.city) {
      await this.citiesService.findById(dto.city);
    }
    story.set(dto);
    return story.save();
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const story = await this.findById(id);
    this.assertCan(Action.Delete, story, user);
    story.deleted = true;
    await story.save();
  }

  /** Record-level authorization: editors may only touch their own stories. */
  private assertCan(action: Action, story: StoryDocument, user: RequestUser) {
    const ability = this.caslAbilityFactory.createForUser(user);
    try {
      ForbiddenError.from(ability).throwUnlessCan(
        action,
        subject('Story', {
          ...story.toObject(),
          createdBy: story.createdBy?.toString(),
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
