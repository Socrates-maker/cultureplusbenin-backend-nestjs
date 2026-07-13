import { ForbiddenError, subject } from '@casl/ability';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CaslAbilityFactory, RequestUser } from '../casl/casl-ability.factory';
import { Action } from '../casl/action.enum';
import { CitiesService } from '../cities/cities.service';
import {
  PageOptions,
  Paginated,
  paginate,
} from '../common/utils/pagination.util';
import { MediaType } from '../common/enums/media.enum';
import { ModerationStatus } from '../common/enums/moderation-status.enum';
import { Role } from '../common/enums/role.enum';
import { TestimonialSubjectType } from '../common/enums/testimonial.enum';
import { HistoricalFiguresService } from '../historical-figures/historical-figures.service';
import { Media, MediaDocument } from '../media/schemas/media.schema';
import { TouristSitesService } from '../tourist-sites/tourist-sites.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import {
  Testimonial,
  TestimonialDocument,
} from './schemas/testimonial.schema';

@Injectable()
export class TestimonialsService {
  constructor(
    @InjectModel(Testimonial.name)
    private readonly testimonialModel: Model<TestimonialDocument>,
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    private readonly citiesService: CitiesService,
    private readonly touristSitesService: TouristSitesService,
    private readonly historicalFiguresService: HistoricalFiguresService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async create(
    dto: CreateTestimonialDto,
    user: RequestUser,
  ): Promise<TestimonialDocument> {
    // Ensure the entity the testimonial is about actually exists.
    await this.assertSubjectExists(dto.subjectType, dto.subject);
    // Trusted contributors (editor / admin) self-publish; regular users'
    // submissions stay pending until an admin validates them.
    const trusted = this.isTrusted(user);
    const testimonial = new this.testimonialModel({
      ...dto,
      createdBy: user.userId,
      status: trusted ? ModerationStatus.APPROVED : ModerationStatus.PENDING,
      reviewedBy: trusted ? user.userId : undefined,
      reviewedAt: trusted ? new Date() : undefined,
    });
    return testimonial.save();
  }

  /**
   * Public listing, optionally filtered by subject. Hides testimonials awaiting
   * validation or rejected. `$nin` also matches legacy documents that predate
   * the `status` field, so no data migration is required.
   */
  findAll(
    filter: {
      subjectType?: TestimonialSubjectType;
      subject?: string;
    } = {},
    pagination: PageOptions = {},
  ): Promise<Paginated<TestimonialDocument>> {
    const query: Record<string, unknown> = {
      deleted: false,
      status: { $nin: [ModerationStatus.PENDING, ModerationStatus.REJECTED] },
    };
    if (filter.subjectType) query.subjectType = filter.subjectType;
    if (filter.subject) query.subject = filter.subject;
    return paginate<TestimonialDocument>(
      this.testimonialModel,
      query,
      pagination,
      { populate: ['coverMedia', 'media'] },
    );
  }

  /** Moderation queue: testimonials awaiting admin validation (admin only). */
  findPending(
    pagination: PageOptions = {},
  ): Promise<Paginated<TestimonialDocument>> {
    return paginate<TestimonialDocument>(
      this.testimonialModel,
      { deleted: false, status: ModerationStatus.PENDING },
      pagination,
    );
  }

  /** The caller's own submissions, whatever their moderation status. */
  findMine(
    user: RequestUser,
    pagination: PageOptions = {},
  ): Promise<Paginated<TestimonialDocument>> {
    return paginate<TestimonialDocument>(
      this.testimonialModel,
      { deleted: false, createdBy: user.userId },
      pagination,
      { populate: ['coverMedia', 'media'] },
    );
  }

  /**
   * Internal lookup, unrestricted by moderation status — used for ownership
   * checks and updates. Do not expose pending / rejected testimonials to the
   * public through this.
   */
  async findById(id: string): Promise<TestimonialDocument> {
    const testimonial = await this.testimonialModel
      .findOne({ _id: id, deleted: false })
      .populate('coverMedia')
      .populate('media')
      .exec();
    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }
    return testimonial;
  }

  /** Public single lookup: hides testimonials awaiting validation or rejected. */
  async findPublicById(id: string): Promise<TestimonialDocument> {
    const testimonial = await this.findById(id);
    if (this.isHidden(testimonial.status)) {
      throw new NotFoundException('Testimonial not found');
    }
    return testimonial;
  }

  async update(
    id: string,
    dto: UpdateTestimonialDto,
    user: RequestUser,
  ): Promise<TestimonialDocument> {
    const testimonial = await this.findById(id);
    this.assertCan(Action.Update, testimonial, user);
    if (dto.subjectType && dto.subject) {
      await this.assertSubjectExists(dto.subjectType, dto.subject);
    }
    // The cover must be an image, and the testimonial media a video / audio;
    // both must be media owned by this testimonial.
    if (dto.coverMedia) {
      await this.assertMediaBelongs(dto.coverMedia, id, [MediaType.IMAGE]);
    }
    if (dto.media) {
      await this.assertMediaBelongs(dto.media, id, [
        MediaType.VIDEO,
        MediaType.AUDIO,
      ]);
    }
    testimonial.set(dto);
    // A non-trusted author editing an already-approved testimonial sends it
    // back to moderation, so approved content can't be silently swapped out.
    if (
      !this.isTrusted(user) &&
      testimonial.status === ModerationStatus.APPROVED
    ) {
      testimonial.status = ModerationStatus.PENDING;
      testimonial.reviewedBy = undefined;
      testimonial.reviewedAt = undefined;
      testimonial.rejectionReason = undefined;
    }
    return testimonial.save();
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const testimonial = await this.findById(id);
    this.assertCan(Action.Delete, testimonial, user);
    testimonial.deleted = true;
    await testimonial.save();
  }

  /** Admin validation: publish a pending / rejected submission. */
  async approve(id: string, user: RequestUser): Promise<TestimonialDocument> {
    const testimonial = await this.findById(id);
    this.assertCan(Action.Approve, testimonial, user);
    testimonial.status = ModerationStatus.APPROVED;
    testimonial.reviewedBy = new Types.ObjectId(user.userId);
    testimonial.reviewedAt = new Date();
    testimonial.rejectionReason = undefined;
    return testimonial.save();
  }

  /** Admin validation: reject a submission with an optional reason. */
  async reject(
    id: string,
    user: RequestUser,
    reason?: string,
  ): Promise<TestimonialDocument> {
    const testimonial = await this.findById(id);
    this.assertCan(Action.Approve, testimonial, user);
    testimonial.status = ModerationStatus.REJECTED;
    testimonial.reviewedBy = new Types.ObjectId(user.userId);
    testimonial.reviewedAt = new Date();
    testimonial.rejectionReason = reason;
    return testimonial.save();
  }

  /** True when a testimonial must be hidden from the public. */
  private isHidden(status?: ModerationStatus): boolean {
    return (
      status === ModerationStatus.PENDING ||
      status === ModerationStatus.REJECTED
    );
  }

  private isTrusted(user: RequestUser): boolean {
    return user.role === Role.ADMIN || user.role === Role.EDITOR;
  }

  /** Ensure the subject the testimonial is about exists, based on its type. */
  private async assertSubjectExists(
    subjectType: TestimonialSubjectType,
    subjectId: string,
  ): Promise<void> {
    switch (subjectType) {
      case TestimonialSubjectType.CITY:
        await this.citiesService.findById(subjectId);
        break;
      case TestimonialSubjectType.TOURIST_SITE:
        await this.touristSitesService.findById(subjectId);
        break;
      case TestimonialSubjectType.HISTORICAL_FIGURE:
        await this.historicalFiguresService.findById(subjectId);
        break;
    }
  }

  /**
   * Ensure the referenced media exists, is one of the expected types and is
   * actually owned by this testimonial (so foreign media can't be attached).
   */
  private async assertMediaBelongs(
    mediaId: string,
    testimonialId: string,
    expected: MediaType[],
  ): Promise<void> {
    const media = await this.mediaModel
      .findOne({ _id: mediaId, deleted: false })
      .exec();
    if (!media) {
      throw new NotFoundException('Media not found');
    }
    if (
      media.ownerType !== 'Testimonial' ||
      media.owner.toString() !== testimonialId
    ) {
      throw new BadRequestException(
        'Media must belong to this testimonial (ownerType Testimonial)',
      );
    }
    if (!expected.includes(media.type)) {
      throw new BadRequestException(
        `Media must be of type ${expected.join(' or ')}`,
      );
    }
  }

  /** Record-level authorization: editors may only touch their own testimonials. */
  private assertCan(
    action: Action,
    testimonial: TestimonialDocument,
    user: RequestUser,
  ) {
    const ability = this.caslAbilityFactory.createForUser(user);
    try {
      ForbiddenError.from(ability).throwUnlessCan(
        action,
        subject('Testimonial', {
          ...testimonial.toObject(),
          createdBy: testimonial.createdBy?.toString(),
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
