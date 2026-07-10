import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Action } from '../casl/action.enum';
import { CheckPolicies } from '../casl/policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { CreateMemoryItemDto } from './dto/create-memory-item.dto';
import { UpdateMemoryItemDto } from './dto/update-memory-item.dto';
import { MemoryDifficulty } from './schemas/memory-item.schema';
import { MemoryService } from './memory.service';

@ApiTags('memory-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
@Controller('admin/memory')
export class MemoryAdminController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post('items')
  @ApiOperation({ summary: 'Create a memory item (admin)' })
  createItem(@Body() dto: CreateMemoryItemDto) {
    return this.memoryService.createItem(dto);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update a memory item (admin)' })
  updateItem(@Param('id') id: string, @Body() dto: UpdateMemoryItemDto) {
    return this.memoryService.updateItem(id, dto);
  }

  @Delete('items/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a memory item (admin)' })
  async deleteItem(@Param('id') id: string) {
    await this.memoryService.deleteItem(id);
  }

  @Get('items')
  @ApiOperation({ summary: 'List memory items with pagination and filters (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'difficulty', required: false, enum: MemoryDifficulty })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'isPublished', required: false, type: Boolean })
  listItems(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('difficulty') difficulty?: MemoryDifficulty,
    @Query('categoryId') categoryId?: string,
    @Query('isPublished') isPublished?: boolean,
  ) {
    return this.memoryService.listItems({
      page,
      limit,
      difficulty,
      categoryId,
      isPublished,
    });
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed memory items for local testing (admin, temporary)' })
  seed() {
    return this.memoryService.seedItems();
  }
}
