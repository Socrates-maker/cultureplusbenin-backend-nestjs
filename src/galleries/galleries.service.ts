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
import { GalleryOwnerType } from '../common/enums/gallery.enum';
import {
  PageOptions,
  Paginated,
  paginate,
} from '../common/utils/pagination.util';
import { EventsService } from '../events/events.service';
import { StoriesService } from '../stories/stories.service';
import { TouristSitesService } from '../tourist-sites/tourist-sites.service';
import { TraditionsService } from '../traditions/traditions.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { Gallery, GalleryDocument } from './schemas/gallery.schema';

interface GalleryFilter {
  ownerType?: GalleryOwnerType;
  owner?: string;
}

@Injectable()
export class GalleriesService {
  constructor(
    @InjectModel(Gallery.name)
    private readonly galleryModel: Model<GalleryDocument>,
    private readonly citiesService: CitiesService,
    private readonly touristSitesService: TouristSitesService,
    private readonly storiesService: StoriesService,
    private readonly traditionsService: TraditionsService,
    private readonly eventsService: EventsService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async create(
    dto: CreateGalleryDto,
    user: RequestUser,
  ): Promise<GalleryDocument> {
    // Ensure the referenced owner (city or tourist site) exists before linking.
    await this.assertOwnerExists(dto.ownerType, dto.owner);
    const gallery = new this.galleryModel({ ...dto, createdBy: user.userId });
    return gallery.save();
  }

  findAll(
    filter: GalleryFilter = {},
    pagination: PageOptions = {},
  ): Promise<Paginated<GalleryDocument>> {
    const query: Record<string, unknown> = { deleted: false };
    if (filter.ownerType) {
      query.ownerType = filter.ownerType;
    }
    if (filter.owner) {
      query.owner = filter.owner;
    }
    return paginate<GalleryDocument>(this.galleryModel, query, pagination, {
      populate: ['media'],
    });
  }

  async findById(id: string): Promise<GalleryDocument> {
    const gallery = await this.galleryModel
      .findOne({ _id: id, deleted: false })
      .populate('media')
      .exec();
    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }
    return gallery;
  }

  async update(
    id: string,
    dto: UpdateGalleryDto,
    user: RequestUser,
  ): Promise<GalleryDocument> {
    const gallery = await this.findById(id);
    this.assertCan(Action.Update, gallery, user);
    gallery.set(dto);
    // Re-validate the owner whenever the relation is (re)assigned.
    if (dto.owner || dto.ownerType) {
      await this.assertOwnerExists(gallery.ownerType, gallery.owner.toString());
    }
    return gallery.save();
  }

  /** Ensure the referenced owner document exists, based on its type. */
  private async assertOwnerExists(
    ownerType: GalleryOwnerType,
    owner: string,
  ): Promise<void> {
    switch (ownerType) {
      case GalleryOwnerType.CITY:
        await this.citiesService.findById(owner);
        break;
      case GalleryOwnerType.TOURIST_SITE:
        await this.touristSitesService.findById(owner);
        break;
      case GalleryOwnerType.STORY:
        await this.storiesService.findById(owner);
        break;
      case GalleryOwnerType.TRADITION:
        await this.traditionsService.findById(owner);
        break;
      case GalleryOwnerType.EVENT:
        await this.eventsService.findById(owner);
        break;
    }
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const gallery = await this.findById(id);
    this.assertCan(Action.Delete, gallery, user);
    gallery.deleted = true;
    await gallery.save();
  }

  /** Record-level authorization: editors may only touch their own galleries. */
  private assertCan(
    action: Action,
    gallery: GalleryDocument,
    user: RequestUser,
  ) {
    const ability = this.caslAbilityFactory.createForUser(user);
    try {
      ForbiddenError.from(ability).throwUnlessCan(
        action,
        subject('Gallery', {
          ...gallery.toObject(),
          createdBy: gallery.createdBy?.toString(),
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
