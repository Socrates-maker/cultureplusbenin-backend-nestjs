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
import { CreateTouristSiteDto } from './dto/create-tourist-site.dto';
import { UpdateTouristSiteDto } from './dto/update-tourist-site.dto';
import { TouristSitesService } from './tourist-sites.service';

@ApiTags('tourist-sites')
@Controller('tourist-sites')
export class TouristSitesController {
  constructor(private readonly touristSitesService: TouristSitesService) {}

  @Get()
  @ApiOperation({ summary: 'List tourist sites, optionally filtered by city' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city id' })
  findAll(@Query('city') city?: string) {
    return this.touristSitesService.findAll(city);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tourist site by id (public)' })
  findOne(@Param('id') id: string) {
    return this.touristSitesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'TouristSite'))
  @ApiOperation({ summary: 'Create a tourist site (editor / admin)' })
  create(@Body() dto: CreateTouristSiteDto, @CurrentUser() user: RequestUser) {
    return this.touristSitesService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Update, 'TouristSite'))
  @ApiOperation({ summary: 'Update a tourist site (owner editor / admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTouristSiteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.touristSitesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Delete, 'TouristSite'))
  @ApiOperation({
    summary: 'Soft-delete a tourist site (owner editor / admin)',
  })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.touristSitesService.remove(id, user);
  }
}
