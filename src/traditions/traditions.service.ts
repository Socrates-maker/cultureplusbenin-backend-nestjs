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
import { CreateTraditionDto } from './dto/create-tradition.dto';
import { UpdateTraditionDto } from './dto/update-tradition.dto';
import { Tradition, TraditionDocument } from './schemas/tradition.schema';

@Injectable()
export class TraditionsService {
  constructor(
    @InjectModel(Tradition.name)
    private readonly traditionModel: Model<TraditionDocument>,
    private readonly citiesService: CitiesService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async create(
    dto: CreateTraditionDto,
    user: RequestUser,
  ): Promise<TraditionDocument> {
    // Ensure the referenced city exists before linking the tradition to it.
    if (dto.city) {
      await this.citiesService.findById(dto.city);
    }
    const tradition = new this.traditionModel({
      ...dto,
      createdBy: user.userId,
    });
    return tradition.save();
  }

  /** Public listing, filterable by city, tags and free text. */
  findAll(
    filter: {
      city?: string;
      search?: string;
      tags?: string;
    } = {},
    pagination: PageOptions = {},
  ): Promise<Paginated<TraditionDocument>> {
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
    return paginate<TraditionDocument>(this.traditionModel, query, pagination, {
      populate: ['media', 'galleries'],
    });
  }

  /** Distinct tags across visible traditions (filter UIs / autocomplete). */
  async listTags(): Promise<string[]> {
    const tags = await this.traditionModel
      .distinct('tags', { deleted: false })
      .exec();
    return (tags as string[]).sort();
  }

  async findById(id: string): Promise<TraditionDocument> {
    const tradition = await this.traditionModel
      .findOne({ _id: id, deleted: false })
      .populate('media')
      .populate({ path: 'galleries', populate: { path: 'media' } })
      .exec();
    if (!tradition) {
      throw new NotFoundException('Tradition not found');
    }
    return tradition;
  }

  async update(
    id: string,
    dto: UpdateTraditionDto,
    user: RequestUser,
  ): Promise<TraditionDocument> {
    const tradition = await this.findById(id);
    this.assertCan(Action.Update, tradition, user);
    if (dto.city) {
      await this.citiesService.findById(dto.city);
    }
    tradition.set(dto);
    return tradition.save();
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const tradition = await this.findById(id);
    this.assertCan(Action.Delete, tradition, user);
    tradition.deleted = true;
    await tradition.save();
  }

  /** Record-level authorization: editors may only touch their own traditions. */
  private assertCan(
    action: Action,
    tradition: TraditionDocument,
    user: RequestUser,
  ) {
    const ability = this.caslAbilityFactory.createForUser(user);
    try {
      ForbiddenError.from(ability).throwUnlessCan(
        action,
        subject('Tradition', {
          ...tradition.toObject(),
          createdBy: tradition.createdBy?.toString(),
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
