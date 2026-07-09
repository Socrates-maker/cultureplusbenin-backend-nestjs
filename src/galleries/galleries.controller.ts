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
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { GalleriesService } from './galleries.service';

@ApiTags('galleries')
@Controller('galleries')
export class GalleriesController {
  constructor(private readonly galleriesService: GalleriesService) {}

  @Get()
  @ApiOperation({ summary: 'List galleries, optionally filtered by city' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city id' })
  findAll(@Query('city') city?: string) {
    return this.galleriesService.findAll(city);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a gallery by id (public)' })
  findOne(@Param('id') id: string) {
    return this.galleriesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'Gallery'))
  @ApiOperation({ summary: 'Create a gallery (editor / admin)' })
  create(@Body() dto: CreateGalleryDto, @CurrentUser() user: RequestUser) {
    return this.galleriesService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Update, 'Gallery'))
  @ApiOperation({ summary: 'Update a gallery (owner editor / admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGalleryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.galleriesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Gallery'))
  @ApiOperation({ summary: 'Soft-delete a gallery (owner editor / admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.galleriesService.remove(id, user);
  }
}
