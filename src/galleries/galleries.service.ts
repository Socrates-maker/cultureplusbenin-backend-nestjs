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
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { Gallery, GalleryDocument } from './schemas/gallery.schema';

@Injectable()
export class GalleriesService {
  constructor(
    @InjectModel(Gallery.name)
    private readonly galleryModel: Model<GalleryDocument>,
    private readonly citiesService: CitiesService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async create(
    dto: CreateGalleryDto,
    user: RequestUser,
  ): Promise<GalleryDocument> {
    // Ensure the referenced city exists before linking the gallery to it.
    await this.citiesService.findById(dto.city);
    const gallery = new this.galleryModel({ ...dto, createdBy: user.userId });
    return gallery.save();
  }

  findAll(cityId?: string): Promise<GalleryDocument[]> {
    const filter: Record<string, unknown> = { deleted: false };
    if (cityId) {
      filter.city = cityId;
    }
    return this.galleryModel.find(filter).populate('media').exec();
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
    if (dto.city) {
      await this.citiesService.findById(dto.city);
    }
    gallery.set(dto);
    return gallery.save();
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
