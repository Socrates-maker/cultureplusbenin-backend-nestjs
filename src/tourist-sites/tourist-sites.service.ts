import { ForbiddenError, subject } from '@casl/ability';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CitiesService } from '../cities/cities.service';
import { CaslAbilityFactory, RequestUser } from '../casl/casl-ability.factory';
import { Action } from '../casl/action.enum';
import { buildSearchFilter } from '../common/utils/search.util';
import {
  PageOptions,
  Paginated,
  paginate,
} from '../common/utils/pagination.util';
import { ModerationStatus } from '../common/enums/moderation-status.enum';
import { Role } from '../common/enums/role.enum';
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
    // Trusted contributors (editor / admin) self-publish; regular users'
    // submissions stay pending until an admin validates them.
    const trusted = this.isTrusted(user);
    const site = new this.touristSiteModel({
      ...dto,
      createdBy: user.userId,
      status: trusted ? ModerationStatus.APPROVED : ModerationStatus.PENDING,
      reviewedBy: trusted ? user.userId : undefined,
      reviewedAt: trusted ? new Date() : undefined,
    });
    return site.save();
  }

  /**
   * Public listing, optionally filtered by city. Hides sites awaiting
   * validation or rejected. `$nin` also matches legacy documents that predate
   * the `status` field (missing status counts as visible), so no data
   * migration is required.
   */
  findAll(
    cityId?: string,
    search?: string,
    pagination: PageOptions = {},
  ): Promise<Paginated<TouristSiteDocument>> {
    const filter: Record<string, unknown> = {
      deleted: false,
      status: { $nin: [ModerationStatus.PENDING, ModerationStatus.REJECTED] },
    };
    if (cityId) {
      filter.city = cityId;
    }
    const searchFilter = buildSearchFilter(search, [
      'name',
      'description',
      'history',
    ]);
    if (searchFilter) {
      Object.assign(filter, searchFilter);
    }
    return paginate<TouristSiteDocument>(this.touristSiteModel, filter, pagination, {
      populate: ['media'],
    });
  }

  /** True when a site must be hidden from the public (awaiting / denied). */
  private isHidden(status?: ModerationStatus): boolean {
    return (
      status === ModerationStatus.PENDING ||
      status === ModerationStatus.REJECTED
    );
  }

  /** Moderation queue: sites awaiting admin validation (admin only). */
  findPending(
    pagination: PageOptions = {},
  ): Promise<Paginated<TouristSiteDocument>> {
    return paginate<TouristSiteDocument>(
      this.touristSiteModel,
      { deleted: false, status: ModerationStatus.PENDING },
      pagination,
    );
  }

  /** The caller's own submissions, whatever their moderation status. */
  findMine(
    user: RequestUser,
    pagination: PageOptions = {},
  ): Promise<Paginated<TouristSiteDocument>> {
    return paginate<TouristSiteDocument>(
      this.touristSiteModel,
      { deleted: false, createdBy: user.userId },
      pagination,
      { populate: ['media'] },
    );
  }

  /**
   * Internal lookup, unrestricted by moderation status — used for ownership
   * checks, updates and media attachment. Do not expose pending / rejected
   * sites to the public through this.
   */
  async findById(id: string): Promise<TouristSiteDocument> {
    const site = await this.touristSiteModel
      .findOne({ _id: id, deleted: false })
      .populate('media')
      .populate({ path: 'galleries', populate: { path: 'media' } })
      .exec();
    if (!site) {
      throw new NotFoundException('Tourist site not found');
    }
    return site;
  }

  /** Public single-site lookup: hides sites awaiting validation or rejected. */
  async findPublicById(id: string): Promise<TouristSiteDocument> {
    const site = await this.findById(id);
    if (this.isHidden(site.status)) {
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
    // A non-trusted author editing an already-approved site sends it back to
    // moderation, so approved content can't be silently swapped out.
    if (!this.isTrusted(user) && site.status === ModerationStatus.APPROVED) {
      site.status = ModerationStatus.PENDING;
      site.reviewedBy = undefined;
      site.reviewedAt = undefined;
      site.rejectionReason = undefined;
    }
    return site.save();
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const site = await this.findById(id);
    this.assertCan(Action.Delete, site, user);
    site.deleted = true;
    await site.save();
  }

  /** Admin validation: publish a pending / rejected submission. */
  async approve(id: string, user: RequestUser): Promise<TouristSiteDocument> {
    const site = await this.findById(id);
    this.assertCan(Action.Approve, site, user);
    site.status = ModerationStatus.APPROVED;
    site.reviewedBy = new Types.ObjectId(user.userId);
    site.reviewedAt = new Date();
    site.rejectionReason = undefined;
    return site.save();
  }

  /** Admin validation: reject a submission with an optional reason. */
  async reject(
    id: string,
    user: RequestUser,
    reason?: string,
  ): Promise<TouristSiteDocument> {
    const site = await this.findById(id);
    this.assertCan(Action.Approve, site, user);
    site.status = ModerationStatus.REJECTED;
    site.reviewedBy = new Types.ObjectId(user.userId);
    site.reviewedAt = new Date();
    site.rejectionReason = reason;
    return site.save();
  }

  private isTrusted(user: RequestUser): boolean {
    return user.role === Role.ADMIN || user.role === Role.EDITOR;
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
