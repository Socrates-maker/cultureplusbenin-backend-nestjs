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
import { CreateHistoricalFigureDto } from './dto/create-historical-figure.dto';
import { UpdateHistoricalFigureDto } from './dto/update-historical-figure.dto';
import { HistoricalFiguresService } from './historical-figures.service';

@ApiTags('historical-figures')
@Controller('historical-figures')
export class HistoricalFiguresController {
  constructor(
    private readonly historicalFiguresService: HistoricalFiguresService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List historical figures, optionally filtered by city',
  })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city id' })
  findAll(@Query('city') city?: string) {
    return this.historicalFiguresService.findAll(city);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a historical figure by id (public)' })
  findOne(@Param('id') id: string) {
    return this.historicalFiguresService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'HistoricalFigure'))
  @ApiOperation({ summary: 'Create a historical figure (editor / admin)' })
  create(
    @Body() dto: CreateHistoricalFigureDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.historicalFiguresService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Update, 'HistoricalFigure'))
  @ApiOperation({
    summary: 'Update a historical figure (owner editor / admin)',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHistoricalFigureDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.historicalFiguresService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Delete, 'HistoricalFigure'))
  @ApiOperation({
    summary: 'Soft-delete a historical figure (owner editor / admin)',
  })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.historicalFiguresService.remove(id, user);
  }
}
