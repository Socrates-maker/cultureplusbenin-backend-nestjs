import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../casl/casl-ability.factory';
import { GetMemoryItemsDto } from './dto/get-memory-items.dto';
import { SubmitMemoryAttemptDto } from './dto/submit-memory-attempt.dto';
import { MemoryService } from './memory.service';

@ApiTags('memory')
@Controller('memory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get('items')
  @ApiOperation({ summary: 'Get memory items for a game deck' })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'difficulty', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getItems(@Query() dto: GetMemoryItemsDto) {
    return this.memoryService.getItems(dto);
  }

  @Post('attempts')
  @ApiOperation({ summary: 'Submit a memory game attempt' })
  submitAttempt(
    @CurrentUser() user: RequestUser,
    @Body() dto: SubmitMemoryAttemptDto,
  ) {
    return this.memoryService.submitAttempt(user.userId, dto);
  }

  @Get('best-score')
  @ApiOperation({ summary: 'Get the current user best memory score' })
  getBestScore(@CurrentUser() user: RequestUser) {
    return this.memoryService.getBestScore(user.userId);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get memory leaderboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLeaderboard(@Query('limit') limit?: number) {
    return this.memoryService.getLeaderboard(limit);
  }
}
