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
import { CreateTraditionDto } from './dto/create-tradition.dto';
import { UpdateTraditionDto } from './dto/update-tradition.dto';
import { TraditionsService } from './traditions.service';

@ApiTags('traditions')
@Controller('traditions')
export class TraditionsController {
  constructor(private readonly traditionsService: TraditionsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List traditions (public), filterable by city, tags and searched',
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
      'Comma-separated tags; matches traditions carrying at least one of them',
  })
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('city') city?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
  ) {
    return this.traditionsService.findAll({ city, search, tags }, pagination);
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all tags used by traditions' })
  listTags() {
    return this.traditionsService.listTags();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tradition by id (public)' })
  findOne(@Param('id') id: string) {
    return this.traditionsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'Tradition'))
  @ApiOperation({ summary: 'Create a tradition (editor / admin)' })
  create(@Body() dto: CreateTraditionDto, @CurrentUser() user: RequestUser) {
    return this.traditionsService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Update, 'Tradition'))
  @ApiOperation({ summary: 'Update a tradition (owner editor / admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTraditionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.traditionsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Tradition'))
  @ApiOperation({ summary: 'Soft-delete a tradition (owner editor / admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.traditionsService.remove(id, user);
  }
}
