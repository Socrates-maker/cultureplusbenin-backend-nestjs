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
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List events (public, chronological), filterable by city, tags and searched',
  })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city id' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Free text search on title, description, origin and tags',
  })
  @ApiQuery({
    name: 'tags',
    required: false,
    description:
      'Comma-separated tags; matches events carrying at least one of them',
  })
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('city') city?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
  ) {
    return this.eventsService.findAll({ city, search, tags }, pagination);
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all tags used by events' })
  listTags() {
    return this.eventsService.listTags();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event by id (public)' })
  findOne(@Param('id') id: string) {
    return this.eventsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'Event'))
  @ApiOperation({ summary: 'Create an event (editor / admin)' })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: RequestUser) {
    return this.eventsService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Update, 'Event'))
  @ApiOperation({ summary: 'Update an event (owner editor / admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.eventsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Event'))
  @ApiOperation({ summary: 'Soft-delete an event (owner editor / admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.eventsService.remove(id, user);
  }
}
