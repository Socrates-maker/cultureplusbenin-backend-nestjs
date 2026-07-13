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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestUser } from '../casl/casl-ability.factory';
import { Action } from '../casl/action.enum';
import { CheckPolicies } from '../casl/policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { MediaOwnerType, MediaType } from '../common/enums/media.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @ApiOperation({ summary: 'List media, optionally filtered by owner / type' })
  @ApiQuery({ name: 'ownerType', required: false, enum: MediaOwnerType })
  @ApiQuery({
    name: 'owner',
    required: false,
    description: 'Owner resource id',
  })
  @ApiQuery({ name: 'type', required: false, enum: MediaType })
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('ownerType') ownerType?: MediaOwnerType,
    @Query('owner') owner?: string,
    @Query('type') type?: MediaType,
  ) {
    return this.mediaService.findAll({ ownerType, owner, type }, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a media by id (public)' })
  findOne(@Param('id') id: string) {
    return this.mediaService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'Media'))
  @ApiOperation({
    summary:
      'Attach a media (by url) to a city, tourist site, gallery or historical figure',
  })
  create(@Body() dto: CreateMediaDto, @CurrentUser() user: RequestUser) {
    return this.mediaService.create(dto, user);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'Media'))
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file to Cloudinary and return its url (to use in POST /media)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.mediaService.upload(file);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Update, 'Media'))
  @ApiOperation({ summary: 'Update a media (owner editor / admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMediaDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.mediaService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Media'))
  @ApiOperation({ summary: 'Soft-delete a media (owner editor / admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.mediaService.remove(id, user);
  }
}
