import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GetQuizQuestionsDto } from './dto/get-quiz-questions.dto';
import { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto';
import { QuizDifficulty } from './schemas/quiz-question.schema';
import { QuizService } from './quiz.service';

@ApiTags('quiz')
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('questions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return randomized questions for the selected level' })
  getQuestions(@Query() dto: GetQuizQuestionsDto) {
    return this.quizService.getQuestions(dto);
  }

  @Post('attempts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit answers and compute score server-side' })
  submitAttempt(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubmitQuizAttemptDto,
  ) {
    return this.quizService.submitAttempt(userId, dto);
  }

  @Get('best-score')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user best score by difficulty' })
  getBestScore(
    @CurrentUser('userId') userId: string,
    @Query('difficulty') difficulty: QuizDifficulty,
  ) {
    return this.quizService.getBestScore(userId, difficulty);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get public leaderboard by difficulty' })
  @ApiQuery({ name: 'difficulty', required: true, enum: QuizDifficulty })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLeaderboard(
    @Query('difficulty') difficulty: QuizDifficulty,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.quizService.getLeaderboard(difficulty, limit);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List available quiz categories' })
  getCategories() {
    return this.quizService.getCategories();
  }
}
