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
import { CreateTouristSiteDto } from './dto/create-tourist-site.dto';
import { RejectTouristSiteDto } from './dto/reject-tourist-site.dto';
import { UpdateTouristSiteDto } from './dto/update-tourist-site.dto';
import { TouristSitesService } from './tourist-sites.service';

@ApiTags('tourist-sites')
@Controller('tourist-sites')
export class TouristSitesController {
  constructor(private readonly touristSitesService: TouristSitesService) {}

  @Get()
  @ApiOperation({
    summary:
      'List approved tourist sites, optionally filtered by city and searched',
  })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city id' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Free text search on name, description, history and tags',
  })
  @ApiQuery({
    name: 'tags',
    required: false,
    description:
      'Comma-separated tags; matches sites carrying at least one of them',
  })
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('city') city?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
  ) {
    return this.touristSitesService.findAll(city, search, tags, pagination);
  }

  @Get('tags')
  @ApiOperation({
    summary: 'List all tags used by publicly visible tourist sites',
  })
  listTags() {
    return this.touristSitesService.listTags();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List my own tourist site submissions (any moderation status)',
  })
  findMine(
    @CurrentUser() user: RequestUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.touristSitesService.findMine(user, pagination);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Approve, 'TouristSite'))
  @ApiOperation({
    summary: 'List tourist sites awaiting validation (admin)',
  })
  findPending(@Query() pagination: PaginationQueryDto) {
    return this.touristSitesService.findPending(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an approved tourist site by id (public)' })
  findOne(@Param('id') id: string) {
    return this.touristSitesService.findPublicById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'TouristSite'))
  @ApiOperation({
    summary:
      'Submit a tourist site. Users create pending sites (validated by an admin); editors / admins publish directly',
  })
  create(@Body() dto: CreateTouristSiteDto, @CurrentUser() user: RequestUser) {
    return this.touristSitesService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Update, 'TouristSite'))
  @ApiOperation({
    summary:
      'Update a tourist site (owner / admin). Owner edits re-enter moderation',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTouristSiteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.touristSitesService.update(id, dto, user);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Approve, 'TouristSite'))
  @ApiOperation({ summary: 'Approve (publish) a tourist site (admin)' })
  approve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.touristSitesService.approve(id, user);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Approve, 'TouristSite'))
  @ApiOperation({
    summary: 'Reject a tourist site with an optional reason (admin)',
  })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTouristSiteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.touristSitesService.reject(id, user, dto.reason);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Delete, 'TouristSite'))
  @ApiOperation({ summary: 'Soft-delete a tourist site (owner / admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.touristSitesService.remove(id, user);
  }
}
