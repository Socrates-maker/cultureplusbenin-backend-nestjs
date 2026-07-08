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
import { CreateTouristSiteDto } from './dto/create-tourist-site.dto';
import { UpdateTouristSiteDto } from './dto/update-tourist-site.dto';
import {
  TouristSite,
  TouristSiteDocument,
} from './schemas/tourist-site.schema';

@Injectable()
export class TouristSitesService {
  constructor(
    @InjectModel(TouristSite.name)
    private readonly touristSiteModel: Model<TouristSiteDocument>,
    private readonly citiesService: CitiesService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async create(
    dto: CreateTouristSiteDto,
    user: RequestUser,
  ): Promise<TouristSiteDocument> {
    // Ensure the referenced city exists before linking the site to it.
    await this.citiesService.findById(dto.city);
    const site = new this.touristSiteModel({ ...dto, createdBy: user.userId });
    return site.save();
  }

  findAll(cityId?: string): Promise<TouristSiteDocument[]> {
    const filter: Record<string, unknown> = { deleted: false };
    if (cityId) {
      filter.city = cityId;
    }
    return this.touristSiteModel.find(filter).populate('media').exec();
  }

  async findById(id: string): Promise<TouristSiteDocument> {
    const site = await this.touristSiteModel
      .findOne({ _id: id, deleted: false })
      .populate('media')
      .exec();
    if (!site) {
      throw new NotFoundException('Tourist site not found');
    }
    return site;
  }

  async update(
    id: string,
    dto: UpdateTouristSiteDto,
    user: RequestUser,
  ): Promise<TouristSiteDocument> {
    const site = await this.findById(id);
    this.assertCan(Action.Update, site, user);
    if (dto.city) {
      await this.citiesService.findById(dto.city);
    }
    site.set(dto);
    return site.save();
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const site = await this.findById(id);
    this.assertCan(Action.Delete, site, user);
    site.deleted = true;
    await site.save();
  }

  /** Record-level authorization: editors may only touch their own sites. */
  private assertCan(
    action: Action,
    site: TouristSiteDocument,
    user: RequestUser,
  ) {
    const ability = this.caslAbilityFactory.createForUser(user);
    try {
      ForbiddenError.from(ability).throwUnlessCan(
        action,
        subject('TouristSite', {
          ...site.toObject(),
          createdBy: site.createdBy?.toString(),
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
