import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestUser } from '../casl/casl-ability.factory';
import { Action } from '../casl/action.enum';
import { CheckPolicies } from '../casl/policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TestimonialSubjectType } from '../common/enums/testimonial.enum';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { RejectTestimonialDto } from './dto/reject-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { TestimonialsService } from './testimonials.service';

@ApiTags('testimonials')
@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  @ApiOperation({
    summary: 'List approved testimonials, optionally filtered by subject',
  })
  @ApiQuery({ name: 'subjectType', required: false, enum: TestimonialSubjectType })
  @ApiQuery({
    name: 'subject',
    required: false,
    description: 'Filter by subject id (city, tourist site or historical figure)',
  })
  @ApiQuery({
    name: 'tags',
    required: false,
    description:
      'Comma-separated tags; matches testimonials carrying at least one of them',
  })
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('subjectType') subjectType?: TestimonialSubjectType,
    @Query('subject') subject?: string,
    @Query('tags') tags?: string,
  ) {
    return this.testimonialsService.findAll(
      { subjectType, subject, tags },
      pagination,
    );
  }

  @Get('tags')
  @ApiOperation({
    summary: 'List all tags used by publicly visible testimonials',
  })
  listTags() {
    return this.testimonialsService.listTags();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List my own testimonial submissions (any moderation status)',
  })
  findMine(
    @CurrentUser() user: RequestUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.testimonialsService.findMine(user, pagination);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Approve, 'Testimonial'))
  @ApiOperation({ summary: 'List testimonials awaiting validation (admin)' })
  findPending(@Query() pagination: PaginationQueryDto) {
    return this.testimonialsService.findPending(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an approved testimonial by id (public)' })
  findOne(@Param('id') id: string) {
    return this.testimonialsService.findPublicById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'Testimonial'))
  @ApiOperation({
    summary:
      'Submit a testimonial about a city, tourist site or historical figure. Users create pending testimonials (validated by an admin); editors / admins publish directly',
  })
  create(@Body() dto: CreateTestimonialDto, @CurrentUser() user: RequestUser) {
    return this.testimonialsService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Update, 'Testimonial'))
  @ApiOperation({
    summary:
      'Update a testimonial or attach its cover / media (owner / admin). Owner edits re-enter moderation',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.testimonialsService.update(id, dto, user);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Approve, 'Testimonial'))
  @ApiOperation({ summary: 'Approve (publish) a testimonial (admin)' })
  approve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.testimonialsService.approve(id, user);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Approve, 'Testimonial'))
  @ApiOperation({
    summary: 'Reject a testimonial with an optional reason (admin)',
  })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTestimonialDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.testimonialsService.reject(id, user, dto.reason);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Testimonial'))
  @ApiOperation({ summary: 'Soft-delete a testimonial (owner / admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.testimonialsService.remove(id, user);
  }
}
