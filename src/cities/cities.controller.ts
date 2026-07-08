import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestUser } from '../casl/casl-ability.factory';
import { Action } from '../casl/action.enum';
import { CheckPolicies } from '../casl/policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

@ApiTags('cities')
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  @ApiOperation({ summary: 'List all cities (public)' })
  findAll() {
    return this.citiesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a city by id (public)' })
  findOne(@Param('id') id: string) {
    return this.citiesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Create, 'City'))
  @ApiOperation({ summary: 'Create a city (editor / admin)' })
  create(@Body() dto: CreateCityDto, @CurrentUser() user: RequestUser) {
    return this.citiesService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Update, 'City'))
  @ApiOperation({ summary: 'Update a city (owner editor / admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.citiesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @CheckPolicies((ability) => ability.can(Action.Delete, 'City'))
  @ApiOperation({ summary: 'Soft-delete a city (owner editor / admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.citiesService.remove(id, user);
  }
}
