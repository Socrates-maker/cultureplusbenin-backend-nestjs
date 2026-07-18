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
import { StoryCategory } from '../common/enums/story.enum';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoriesService } from './stories.service';

@ApiTags('stories')
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  @ApiOperation({
    summary:
      'List historical stories (public), filterable by category, city, tags and searched',
  })
  @ApiQuery({ name: 'category', required: false, enum: StoryCategory })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city id' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Free text search on title, description, body and tags',
  })
  @ApiQuery({
    name: 'tags',
    required: false,
    description:
      'Comma-separated tags; matches stories carrying at least one of them',
  })
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('category') category?: StoryCategory,
    @Query('city') city?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
  ) {
    return this.storiesService.findAll(
      { category, city, search, tags },
      pagination,
    );
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all tags used by stories' })
  listTags() {
    return this.storiesService.listTags();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a story by id (public)' })
  findOne(@Param('id') id: string) {
    return this.storiesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'Story'))
  @ApiOperation({ summary: 'Create a story (editor / admin)' })
  create(@Body() dto: CreateStoryDto, @CurrentUser() user: RequestUser) {
    return this.storiesService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Update, 'Story'))
  @ApiOperation({ summary: 'Update a story (owner editor / admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.storiesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Story'))
  @ApiOperation({ summary: 'Soft-delete a story (owner editor / admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.storiesService.remove(id, user);
  }
}
