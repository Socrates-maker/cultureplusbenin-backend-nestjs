import { ForbiddenError, subject } from '@casl/ability';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CaslAbilityFactory, RequestUser } from '../casl/casl-ability.factory';
import { Action } from '../casl/action.enum';
import { buildTagsFilter } from '../common/utils/tags.util';
import {
  PageOptions,
  Paginated,
  paginate,
  paginateWithSearch,
} from '../common/utils/pagination.util';
import { City, CityDocument } from './schemas/city.schema';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

@Injectable()
export class CitiesService {
  constructor(
    @InjectModel(City.name) private readonly cityModel: Model<CityDocument>,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  create(dto: CreateCityDto, user: RequestUser): Promise<CityDocument> {
    const city = new this.cityModel({ ...dto, createdBy: user.userId });
    return city.save();
  }

  /** Public listing, optionally filtered by a free text search and tags. */
  findAll(
    search?: string,
    tags?: string,
    pagination: PageOptions = {},
  ): Promise<Paginated<CityDocument>> {
    const filter: Record<string, unknown> = { deleted: false };
    const tagsFilter = buildTagsFilter(tags);
    if (tagsFilter) {
      Object.assign(filter, tagsFilter);
    }
    return paginateWithSearch<CityDocument>(
      this.cityModel,
      filter,
      search,
      ['name', 'description', 'history', 'tags'],
      pagination,
      { populate: ['media'] },
    );
  }

  /** Distinct tags across visible cities (filter UIs / autocomplete). */
  async listTags(): Promise<string[]> {
    const tags = await this.cityModel
      .distinct('tags', { deleted: false })
      .exec();
    return (tags as string[]).sort();
  }

  async findById(id: string): Promise<CityDocument> {
    const city = await this.cityModel
      .findOne({ _id: id, deleted: false })
      .populate('media')
      .exec();
    if (!city) {
      throw new NotFoundException('City not found');
    }
    return city;
  }

  async update(
    id: string,
    dto: UpdateCityDto,
    user: RequestUser,
  ): Promise<CityDocument> {
    const city = await this.findById(id);
    this.assertCan(Action.Update, city, user);
    city.set(dto);
    return city.save();
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const city = await this.findById(id);
    this.assertCan(Action.Delete, city, user);
    city.deleted = true;
    await city.save();
  }

  /** Record-level authorization: editors may only touch their own cities. */
  private assertCan(action: Action, city: CityDocument, user: RequestUser) {
    const ability = this.caslAbilityFactory.createForUser(user);
    try {
      ForbiddenError.from(ability).throwUnlessCan(
        action,
        subject('City', {
          ...city.toObject(),
          createdBy: city.createdBy?.toString(),
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
