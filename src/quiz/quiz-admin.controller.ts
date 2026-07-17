import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Action } from '../casl/action.enum';
import { CheckPolicies } from '../casl/policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { CreateQuizCategoryDto } from './dto/create-quiz-category.dto';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { UpdateQuizQuestionDto } from './dto/update-quiz-question.dto';
import { QuizDifficulty } from './schemas/quiz-question.schema';
import { QuizService } from './quiz.service';

@ApiTags('quiz-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
@Controller('admin/quiz')
export class QuizAdminController {
  constructor(private readonly quizService: QuizService) {}

  @Post('questions')
  @ApiOperation({ summary: 'Create a quiz question (admin)' })
  createQuestion(@Body() dto: CreateQuizQuestionDto) {
    return this.quizService.createQuestion(dto);
  }

  @Patch('questions/:id')
  @ApiOperation({ summary: 'Update a quiz question (admin)' })
  updateQuestion(@Param('id') id: string, @Body() dto: UpdateQuizQuestionDto) {
    return this.quizService.updateQuestion(id, dto);
  }

  @Delete('questions/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a quiz question (admin)' })
  async deleteQuestion(@Param('id') id: string) {
    await this.quizService.deleteQuestion(id);
  }

  @Get('questions')
  @ApiOperation({ summary: 'List quiz questions with pagination and filters (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'difficulty', required: false, enum: QuizDifficulty })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'isPublished', required: false, type: Boolean })
  listQuestions(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('difficulty') difficulty?: QuizDifficulty,
    @Query('categoryId') categoryId?: string,
    @Query('isPublished', new ParseBoolPipe({ optional: true }))
    isPublished?: boolean,
  ) {
    return this.quizService.listQuestions({
      page,
      limit,
      difficulty,
      categoryId,
      isPublished,
    });
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a quiz category (admin)' })
  createCategory(@Body() dto: CreateQuizCategoryDto) {
    return this.quizService.createCategory(dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List quiz categories (admin)' })
  listCategories() {
    return this.quizService.listCategories();
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed quiz questions for local testing (admin, temporary)' })
  seed() {
    return this.quizService.seedQuestions();
  }
}
