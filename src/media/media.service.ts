import { ForbiddenError, subject } from '@casl/ability';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CitiesService } from '../cities/cities.service';
import { CaslAbilityFactory, RequestUser } from '../casl/casl-ability.factory';
import { Action } from '../casl/action.enum';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MediaOwnerType, MediaType } from '../common/enums/media.enum';
import {
  PageOptions,
  Paginated,
  paginate,
} from '../common/utils/pagination.util';
import { buildTagsFilter } from '../common/utils/tags.util';
import { Role } from '../common/enums/role.enum';
import { GalleriesService } from '../galleries/galleries.service';
import { HistoricalFiguresService } from '../historical-figures/historical-figures.service';
import { TestimonialsService } from '../testimonials/testimonials.service';
import { TouristSitesService } from '../tourist-sites/tourist-sites.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { Media, MediaDocument } from './schemas/media.schema';

export interface MediaFilter {
  ownerType?: MediaOwnerType;
  owner?: string;
  type?: MediaType;
  tags?: string;
}

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
    private readonly citiesService: CitiesService,
    private readonly touristSitesService: TouristSitesService,
    private readonly galleriesService: GalleriesService,
    private readonly historicalFiguresService: HistoricalFiguresService,
    private readonly testimonialsService: TestimonialsService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(dto: CreateMediaDto, user: RequestUser): Promise<MediaDocument> {
    // Make sure the resource this media points to actually exists.
    await this.assertOwnerExists(dto.ownerType, dto.owner);
    // Regular users may only attach media to a testimonial they own, so they
    // can't inject unmoderated media into arbitrary resources.
    await this.assertContributorMayAttach(dto, user);
    const media = new this.mediaModel({ ...dto, createdBy: user.userId });
    return media.save();
  }

  /**
   * Non-trusted users (regular users) can create media only as the cover /
   * content of a testimonial they authored. Editors and admins are unrestricted.
   */
  private async assertContributorMayAttach(
    dto: CreateMediaDto,
    user: RequestUser,
  ): Promise<void> {
    if (user.role === Role.ADMIN || user.role === Role.EDITOR) {
      return;
    }
    if (dto.ownerType !== MediaOwnerType.TESTIMONIAL) {
      throw new ForbiddenException(
        'You may only attach media to your own testimonial',
      );
    }
    const testimonial = await this.testimonialsService.findById(dto.owner);
    if (testimonial.createdBy?.toString() !== user.userId) {
      throw new ForbiddenException(
        'You may only attach media to your own testimonial',
      );
    }
  }

  /**
   * Upload a file to Cloudinary and return its url/metadata.
   * The caller can then attach it as a media via `create()`.
   */
  async upload(file: Express.Multer.File): Promise<{
    url: string;
    publicId: string;
    type: MediaType;
  }> {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    const result = await this.cloudinaryService.uploadFile(file);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      type: this.resolveMediaType(file.mimetype),
    };
  }

  /** Map an uploaded file's mime type to our MediaType enum. */
  private resolveMediaType(mimetype: string): MediaType {
    if (mimetype.startsWith('image/')) return MediaType.IMAGE;
    if (mimetype.startsWith('video/')) return MediaType.VIDEO;
    if (mimetype.startsWith('audio/')) return MediaType.AUDIO;
    throw new BadRequestException(`Unsupported file type: ${mimetype}`);
  }

  findAll(
    filter: MediaFilter = {},
    pagination: PageOptions = {},
  ): Promise<Paginated<MediaDocument>> {
    const query: Record<string, unknown> = { deleted: false };
    if (filter.ownerType) query.ownerType = filter.ownerType;
    if (filter.owner) query.owner = filter.owner;
    if (filter.type) query.type = filter.type;
    const tagsFilter = buildTagsFilter(filter.tags);
    if (tagsFilter) Object.assign(query, tagsFilter);
    return paginate<MediaDocument>(this.mediaModel, query, pagination);
  }

  /** Distinct tags across visible media (filter UIs / autocomplete). */
  async listTags(): Promise<string[]> {
    const tags = await this.mediaModel
      .distinct('tags', { deleted: false })
      .exec();
    return (tags as string[]).sort();
  }

  async findById(id: string): Promise<MediaDocument> {
    const media = await this.mediaModel
      .findOne({ _id: id, deleted: false })
      .exec();
    if (!media) {
      throw new NotFoundException('Media not found');
    }
    return media;
  }

  async update(
    id: string,
    dto: UpdateMediaDto,
    user: RequestUser,
  ): Promise<MediaDocument> {
    const media = await this.findById(id);
    this.assertCan(Action.Update, media, user);
    if (dto.ownerType && dto.owner) {
      await this.assertOwnerExists(dto.ownerType, dto.owner);
    }
    media.set(dto);
    return media.save();
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const media = await this.findById(id);
    this.assertCan(Action.Delete, media, user);

    // Remove the underlying asset from Cloudinary if it was uploaded there.
    if (media.publicId) {
      await this.cloudinaryService.deleteFile(
        media.publicId,
        this.resolveResourceType(media.type),
      );
    }

    media.deleted = true;
    await media.save();
  }

  /** Map our MediaType to a Cloudinary resource type (audio lives under `video`). */
  private resolveResourceType(type: MediaType): 'image' | 'video' {
    return type === MediaType.IMAGE ? 'image' : 'video';
  }

  private async assertOwnerExists(ownerType: MediaOwnerType, owner: string) {
    switch (ownerType) {
      case MediaOwnerType.CITY:
        await this.citiesService.findById(owner);
        break;
      case MediaOwnerType.TOURIST_SITE:
        await this.touristSitesService.findById(owner);
        break;
      case MediaOwnerType.GALLERY:
        await this.galleriesService.findById(owner);
        break;
      case MediaOwnerType.HISTORICAL_FIGURE:
        await this.historicalFiguresService.findById(owner);
        break;
      case MediaOwnerType.TESTIMONIAL:
        await this.testimonialsService.findById(owner);
        break;
    }
  }

  /** Record-level authorization: editors may only touch their own media. */
  private assertCan(action: Action, media: MediaDocument, user: RequestUser) {
    const ability = this.caslAbilityFactory.createForUser(user);
    try {
      ForbiddenError.from(ability).throwUnlessCan(
        action,
        subject('Media', {
          ...media.toObject(),
          createdBy: media.createdBy?.toString(),
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
