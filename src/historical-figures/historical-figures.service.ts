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
import { buildTagsFilter } from '../common/utils/tags.util';
import {
  PageOptions,
  Paginated,
  paginate,
  paginateWithSearch,
} from '../common/utils/pagination.util';
import { CreateHistoricalFigureDto } from './dto/create-historical-figure.dto';
import { UpdateHistoricalFigureDto } from './dto/update-historical-figure.dto';
import {
  HistoricalFigure,
  HistoricalFigureDocument,
} from './schemas/historical-figure.schema';

@Injectable()
export class HistoricalFiguresService {
  constructor(
    @InjectModel(HistoricalFigure.name)
    private readonly historicalFigureModel: Model<HistoricalFigureDocument>,
    private readonly citiesService: CitiesService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async create(
    dto: CreateHistoricalFigureDto,
    user: RequestUser,
  ): Promise<HistoricalFigureDocument> {
    // Ensure the referenced city exists before linking the figure to it.
    await this.citiesService.findById(dto.city);
    const figure = new this.historicalFigureModel({
      ...dto,
      createdBy: user.userId,
    });
    return figure.save();
  }

  findAll(
    cityId?: string,
    search?: string,
    tags?: string,
    pagination: PageOptions = {},
  ): Promise<Paginated<HistoricalFigureDocument>> {
    const filter: Record<string, unknown> = { deleted: false };
    if (cityId) {
      filter.city = cityId;
    }
    const tagsFilter = buildTagsFilter(tags);
    if (tagsFilter) {
      Object.assign(filter, tagsFilter);
    }
    return paginateWithSearch<HistoricalFigureDocument>(
      this.historicalFigureModel,
      filter,
      search,
      ['name', 'description', 'biography', 'tags'],
      pagination,
      { populate: ['media'] },
    );
  }

  /** Distinct tags across visible figures (filter UIs / autocomplete). */
  async listTags(): Promise<string[]> {
    const tags = await this.historicalFigureModel
      .distinct('tags', { deleted: false })
      .exec();
    return (tags as string[]).sort();
  }

  async findById(id: string): Promise<HistoricalFigureDocument> {
    const figure = await this.historicalFigureModel
      .findOne({ _id: id, deleted: false })
      .populate('media')
      .exec();
    if (!figure) {
      throw new NotFoundException('Historical figure not found');
    }
    return figure;
  }

  async update(
    id: string,
    dto: UpdateHistoricalFigureDto,
    user: RequestUser,
  ): Promise<HistoricalFigureDocument> {
    const figure = await this.findById(id);
    this.assertCan(Action.Update, figure, user);
    if (dto.city) {
      await this.citiesService.findById(dto.city);
    }
    figure.set(dto);
    return figure.save();
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const figure = await this.findById(id);
    this.assertCan(Action.Delete, figure, user);
    figure.deleted = true;
    await figure.save();
  }

  /** Record-level authorization: editors may only touch their own figures. */
  private assertCan(
    action: Action,
    figure: HistoricalFigureDocument,
    user: RequestUser,
  ) {
    const ability = this.caslAbilityFactory.createForUser(user);
    try {
      ForbiddenError.from(ability).throwUnlessCan(
        action,
        subject('HistoricalFigure', {
          ...figure.toObject(),
          createdBy: figure.createdBy?.toString(),
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
