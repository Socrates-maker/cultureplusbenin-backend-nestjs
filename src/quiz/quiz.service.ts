import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Action } from '../casl/action.enum';
import { CreateQuizCategoryDto } from './dto/create-quiz-category.dto';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { GetQuizQuestionsDto } from './dto/get-quiz-questions.dto';
import { QuizQuestionResponseDto } from './dto/quiz-question-response.dto';
import { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto';
import { UpdateQuizQuestionDto } from './dto/update-quiz-question.dto';
import {
  QuizAttempt,
  QuizAttemptDocument,
} from './schemas/quiz-attempt.schema';
import {
  QuizCategory,
  QuizCategoryDocument,
} from './schemas/quiz-category.schema';
import {
  QuizDifficulty,
  QuizQuestion,
  QuizQuestionDocument,
} from './schemas/quiz-question.schema';
import {
  UserQuizBestScore,
  UserQuizBestScoreDocument,
} from './schemas/user-quiz-best-score.schema';

interface QuizQuestionAggregate {
  _id: Types.ObjectId;
  question: string;
  feedback: string;
  options: Array<{
    _id: Types.ObjectId;
    label: string;
    isCorrect: boolean;
    order?: number;
  }>;
}

@Injectable()
export class QuizService {
  constructor(
    @InjectModel(QuizCategory.name)
    private readonly quizCategoryModel: Model<QuizCategoryDocument>,
    @InjectModel(QuizQuestion.name)
    private readonly quizQuestionModel: Model<QuizQuestionDocument>,
    @InjectModel(QuizAttempt.name)
    private readonly quizAttemptModel: Model<QuizAttemptDocument>,
    @InjectModel(UserQuizBestScore.name)
    private readonly userQuizBestScoreModel: Model<UserQuizBestScoreDocument>,
  ) {}

  async getQuestions(
    dto: GetQuizQuestionsDto,
  ): Promise<QuizQuestionResponseDto[]> {
    const match: {
      difficulty: QuizDifficulty;
      isPublished: boolean;
      categoryId?: Types.ObjectId;
    } = {
      difficulty: dto.difficulty,
      isPublished: true,
    };

    if (dto.categoryId) {
      match.categoryId = new Types.ObjectId(dto.categoryId);
    }

    const limit = dto.limit ?? 10;
    const docs = await this.quizQuestionModel
      .aggregate<QuizQuestionAggregate>([
        { $match: match },
        { $sample: { size: limit } },
      ])
      .exec();

    return docs.map((doc) => this.toQuestionResponse(doc));
  }

  async submitAttempt(userId: string, dto: SubmitQuizAttemptDto) {
    const uniqueQuestionIds = Array.from(
      new Set(dto.answers.map((entry) => entry.questionId)),
    ).map((id) => new Types.ObjectId(id));

    const questions = await this.quizQuestionModel
      .find({ _id: { $in: uniqueQuestionIds }, difficulty: dto.difficulty })
      .exec();

    const questionMap = new Map<string, QuizQuestionDocument>();
    for (const question of questions) {
      questionMap.set(question._id.toString(), question);
    }

    let score = 0;
    for (const answer of dto.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        continue;
      }
      const selectedOption = question.options.find(
        (opt) => opt._id?.toString() === answer.optionId,
      );
      if (selectedOption?.isCorrect) {
        score += 1;
      }
    }

    const total = dto.answers.length;
    await this.quizAttemptModel.create({
      userId: new Types.ObjectId(userId),
      difficulty: dto.difficulty,
      score,
      total,
      answers: dto.answers.map((entry) => ({
        questionId: new Types.ObjectId(entry.questionId),
        optionId: new Types.ObjectId(entry.optionId),
      })),
    });

    const bestScoreRecord = await this.upsertBestScore(
      userId,
      dto.difficulty,
      score,
      total,
    );

    return {
      score,
      total,
      isNewBest: bestScoreRecord.isNewBest,
      bestScore: bestScoreRecord.bestScore,
    };
  }

  async getBestScore(userId: string, difficulty: QuizDifficulty) {
    const entry = await this.userQuizBestScoreModel
      .findOne({ userId: new Types.ObjectId(userId), difficulty })
      .exec();

    if (!entry) {
      return {
        bestScore: 0,
        bestTotal: 0,
        playedCount: 0,
      };
    }

    return {
      bestScore: entry.bestScore,
      bestTotal: entry.bestTotal,
      playedCount: entry.playedCount,
    };
  }

  async getLeaderboard(difficulty: QuizDifficulty, limit = 10) {
    const cappedLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const leaderboard = await this.userQuizBestScoreModel
      .find({ difficulty })
      .sort({ bestScore: -1, bestTotal: -1, updatedAt: 1 })
      .limit(cappedLimit)
      .populate({
        path: 'userId',
        select: 'firstname lastname email',
      })
      .exec();

    return leaderboard.map((entry, index) => ({
      rank: index + 1,
      user: {
        id: entry.userId?._id?.toString?.() ?? '',
        firstname: entry.userId?.['firstname'] ?? null,
        lastname: entry.userId?.['lastname'] ?? null,
        email: entry.userId?.['email'] ?? null,
      },
      bestScore: entry.bestScore,
      bestTotal: entry.bestTotal,
      playedCount: entry.playedCount,
    }));
  }

  async createQuestion(dto: CreateQuizQuestionDto): Promise<QuizQuestionDocument> {
    this.assertSingleCorrectOption(dto.options);

    const question = new this.quizQuestionModel({
      ...dto,
      categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : undefined,
      options: dto.options.map((opt, index) => ({ ...opt, order: index })),
      isPublished: dto.isPublished ?? true,
    });

    return question.save();
  }

  async updateQuestion(
    id: string,
    dto: UpdateQuizQuestionDto,
  ): Promise<QuizQuestionDocument> {
    const question = await this.quizQuestionModel.findById(id).exec();
    if (!question) {
      throw new NotFoundException('Quiz question not found');
    }

    if (dto.options) {
      this.assertSingleCorrectOption(dto.options);
      question.options = dto.options.map((opt, index) => ({
        label: opt.label,
        isCorrect: opt.isCorrect,
        order: index,
      }));
    }

    if (dto.question !== undefined) question.question = dto.question;
    if (dto.feedback !== undefined) question.feedback = dto.feedback;
    if (dto.difficulty !== undefined) question.difficulty = dto.difficulty;
    if (dto.isPublished !== undefined) question.isPublished = dto.isPublished;
    if (dto.categoryId !== undefined) {
      question.categoryId = dto.categoryId
        ? new Types.ObjectId(dto.categoryId)
        : undefined;
    }

    return question.save();
  }

  async deleteQuestion(id: string): Promise<void> {
    const res = await this.quizQuestionModel.deleteOne({ _id: id }).exec();
    if (res.deletedCount === 0) {
      throw new NotFoundException('Quiz question not found');
    }
  }

  async listQuestions(query: {
    page?: number;
    limit?: number;
    difficulty?: QuizDifficulty;
    categoryId?: string;
    isPublished?: boolean;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: {
      difficulty?: QuizDifficulty;
      categoryId?: Types.ObjectId;
      isPublished?: boolean;
    } = {};

    if (query.difficulty) {
      filter.difficulty = query.difficulty;
    }
    if (query.categoryId) {
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }
    if (query.isPublished !== undefined) {
      filter.isPublished = query.isPublished;
    }

    const [items, total] = await Promise.all([
      this.quizQuestionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.quizQuestionModel.countDocuments(filter).exec(),
    ]);

    return {
      data: items.map((question) => ({
        id: question._id.toString(),
        question: question.question,
        feedback: question.feedback,
        difficulty: question.difficulty,
        categoryId: question.categoryId?.toString() ?? null,
        isPublished: question.isPublished,
        options: question.options.map((opt) => ({
          id: opt._id?.toString() ?? '',
          label: opt.label,
          isCorrect: opt.isCorrect,
        })),
      })),
      page,
      limit,
      total,
    };
  }

  async createCategory(dto: CreateQuizCategoryDto): Promise<QuizCategoryDocument> {
    try {
      const category = new this.quizCategoryModel({
        ...dto,
        slug: dto.slug.toLowerCase(),
      });
      return await category.save();
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException('A quiz category with this slug already exists');
      }
      throw error;
    }
  }

  async getCategories() {
    const categories = await this.quizCategoryModel
      .find()
      .sort({ name: 1 })
      .exec();

    return categories.map((category) => ({
      id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
    }));
  }

  async listCategories() {
    return this.getCategories();
  }

  async seedQuestions() {
    const categoriesBySlug = await this.ensureSeedCategories();
    const seedData = this.getSeedQuestions(categoriesBySlug);

    const existing = await this.quizQuestionModel
      .find({ question: { $in: seedData.map((item) => item.question) } })
      .select('question')
      .lean()
      .exec();

    const existingQuestions = new Set(existing.map((item) => item.question));
    const toInsert = seedData
      .filter((item) => !existingQuestions.has(item.question))
      .map((item) => ({
        ...item,
        options: item.options.map((opt, index) => ({ ...opt, order: index })),
      }));

    if (toInsert.length > 0) {
      await this.quizQuestionModel.insertMany(toInsert);
    }

    return {
      inserted: toInsert.length,
      skipped: seedData.length - toInsert.length,
      totalSeed: seedData.length,
    };
  }

  private async upsertBestScore(
    userId: string,
    difficulty: QuizDifficulty,
    score: number,
    total: number,
  ): Promise<{ isNewBest: boolean; bestScore: number }> {
    const filter = {
      userId: new Types.ObjectId(userId),
      difficulty,
    };

    const entry = await this.userQuizBestScoreModel.findOne(filter).exec();
    if (!entry) {
      const created = await this.userQuizBestScoreModel.create({
        ...filter,
        bestScore: score,
        bestTotal: total,
        playedCount: 1,
      });
      return { isNewBest: true, bestScore: created.bestScore };
    }

    entry.playedCount += 1;
    let isNewBest = false;
    if (score > entry.bestScore) {
      entry.bestScore = score;
      entry.bestTotal = total;
      isNewBest = true;
    }

    await entry.save();
    return { isNewBest, bestScore: entry.bestScore };
  }

  private toQuestionResponse(doc: QuizQuestionAggregate): QuizQuestionResponseDto {
    return {
      id: doc._id.toString(),
      question: doc.question,
      feedback: doc.feedback,
      options: this.shuffleOptions(doc.options).map((opt) => ({
        id: opt._id.toString(),
        label: opt.label,
        isCorrect: opt.isCorrect,
      })),
    };
  }

  private shuffleOptions<T>(options: T[]): T[] {
    const array = [...options];
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  private assertSingleCorrectOption(
    options: Array<{ label: string; isCorrect: boolean }>,
  ) {
    if (!Array.isArray(options) || options.length < 2) {
      throw new BadRequestException('At least 2 options are required');
    }

    const correctCount = options.filter((opt) => opt.isCorrect).length;
    if (correctCount !== 1) {
      throw new BadRequestException(
        'Exactly one option must be marked as correct',
      );
    }
  }

  private async ensureSeedCategories(): Promise<Record<string, Types.ObjectId>> {
    const categories = [
      {
        name: 'Histoire',
        slug: 'histoire',
        description: 'Questions sur les grands faits historiques du Bénin',
      },
      {
        name: 'Géographie',
        slug: 'geographie',
        description: 'Questions sur les villes et régions du Bénin',
      },
      {
        name: 'Culture',
        slug: 'culture',
        description: 'Questions sur les traditions et arts béninois',
      },
    ];

    const ids: Record<string, Types.ObjectId> = {};
    for (const category of categories) {
      const doc = await this.quizCategoryModel
        .findOneAndUpdate(
          { slug: category.slug },
          { $setOnInsert: category },
          { new: true, upsert: true },
        )
        .exec();

      if (!doc) {
        throw new NotFoundException('Unable to initialize quiz categories');
      }

      ids[category.slug] = doc._id;
    }

    return ids;
  }

  private getSeedQuestions(categoriesBySlug: Record<string, Types.ObjectId>) {
    return [
      {
        question:
          "Quelle est la capitale administrative du Bénin depuis 1900, où siège le gouvernement ?",
        feedback:
          "Porto-Novo est la capitale officielle du Bénin, même si Cotonou concentre l'activité économique.",
        difficulty: QuizDifficulty.FACILE,
        categoryId: categoriesBySlug.geographie,
        isPublished: true,
        options: [
          { label: 'Porto-Novo', isCorrect: true },
          { label: 'Cotonou', isCorrect: false },
          { label: 'Parakou', isCorrect: false },
          { label: 'Abomey', isCorrect: false },
        ],
      },
      {
        question: 'Le palais royal d Abomey est lié à quel ancien royaume ?',
        feedback:
          'Les palais royaux d Abomey sont au coeur de l histoire du royaume du Danxome.',
        difficulty: QuizDifficulty.FACILE,
        categoryId: categoriesBySlug.histoire,
        isPublished: true,
        options: [
          { label: 'Danxome', isCorrect: true },
          { label: 'Oyo', isCorrect: false },
          { label: 'Mali', isCorrect: false },
          { label: 'Gao', isCorrect: false },
        ],
      },
      {
        question: 'Quel rythme musical est largement associé aux traditions vodun au Bénin ?',
        feedback:
          'Plusieurs rythmes existent, mais le Tchinkoume est souvent cité dans les pratiques traditionnelles.',
        difficulty: QuizDifficulty.FACILE,
        categoryId: categoriesBySlug.culture,
        isPublished: true,
        options: [
          { label: 'Tchinkoume', isCorrect: true },
          { label: 'Salsa', isCorrect: false },
          { label: 'Flamenco', isCorrect: false },
          { label: 'Fado', isCorrect: false },
        ],
      },
      {
        question: 'Quelle ville est reconnue comme principal port économique du Bénin ?',
        feedback:
          'Le port autonome de Cotonou est un acteur majeur de l économie béninoise et régionale.',
        difficulty: QuizDifficulty.FACILE,
        categoryId: categoriesBySlug.geographie,
        isPublished: true,
        options: [
          { label: 'Cotonou', isCorrect: true },
          { label: 'Natitingou', isCorrect: false },
          { label: 'Kandi', isCorrect: false },
          { label: 'Lokossa', isCorrect: false },
        ],
      },
      {
        question: 'Quelle langue est très parlée dans le sud du Bénin et à Abomey ?',
        feedback: 'Le fon est une langue majeure du sud et du centre du Bénin.',
        difficulty: QuizDifficulty.FACILE,
        categoryId: categoriesBySlug.culture,
        isPublished: true,
        options: [
          { label: 'Fon', isCorrect: true },
          { label: 'Wolof', isCorrect: false },
          { label: 'Lingala', isCorrect: false },
          { label: 'Kikongo', isCorrect: false },
        ],
      },
      {
        question:
          "Quel roi d Abomey est connu pour avoir résisté à la colonisation française à la fin du 19e siècle ?",
        feedback:
          'Le roi Béhanzin a mené une résistance symbolique et militaire contre les troupes françaises.',
        difficulty: QuizDifficulty.INTERMEDIAIRE,
        categoryId: categoriesBySlug.histoire,
        isPublished: true,
        options: [
          { label: 'Béhanzin', isCorrect: true },
          { label: 'Ghézo', isCorrect: false },
          { label: 'Agaja', isCorrect: false },
          { label: 'Tegbessou', isCorrect: false },
        ],
      },
      {
        question: 'Le parc national de la Pendjari se trouve principalement dans quelle zone du Bénin ?',
        feedback:
          'La Pendjari est située dans le nord-ouest du Bénin et fait partie du complexe W-Arly-Pendjari.',
        difficulty: QuizDifficulty.INTERMEDIAIRE,
        categoryId: categoriesBySlug.geographie,
        isPublished: true,
        options: [
          { label: 'Nord-ouest', isCorrect: true },
          { label: 'Sud-est', isCorrect: false },
          { label: 'Centre', isCorrect: false },
          { label: 'Littoral sud', isCorrect: false },
        ],
      },
      {
        question: 'Quelle fête internationale majeure du vodun est célébrée le 10 janvier au Bénin ?',
        feedback:
          'Le 10 janvier est consacré à la fête des religions endogènes, souvent appelée fête du Vodun.',
        difficulty: QuizDifficulty.INTERMEDIAIRE,
        categoryId: categoriesBySlug.culture,
        isPublished: true,
        options: [
          { label: 'Fête du Vodun', isCorrect: true },
          { label: 'Fête des moissons', isCorrect: false },
          { label: 'Fête des ignames', isCorrect: false },
          { label: 'Fête des masques', isCorrect: false },
        ],
      },
      {
        question: 'Le lac Nokoué est directement relié à quelle ville majeure ?',
        feedback:
          'Le lac Nokoué borde Cotonou et héberge la célèbre cité lacustre de Ganvié.',
        difficulty: QuizDifficulty.INTERMEDIAIRE,
        categoryId: categoriesBySlug.geographie,
        isPublished: true,
        options: [
          { label: 'Cotonou', isCorrect: true },
          { label: 'Djougou', isCorrect: false },
          { label: 'Bohicon', isCorrect: false },
          { label: 'Savè', isCorrect: false },
        ],
      },
      {
        question: 'Le terme Amazones du Dahomey désigne historiquement quoi ?',
        feedback:
          'Il s agit des célèbres unités militaires féminines du royaume du Danxome.',
        difficulty: QuizDifficulty.INTERMEDIAIRE,
        categoryId: categoriesBySlug.histoire,
        isPublished: true,
        options: [
          { label: 'Corps militaire féminin du royaume', isCorrect: true },
          { label: 'Marchandes de sel', isCorrect: false },
          { label: 'Poétesses royales', isCorrect: false },
          { label: 'Prêtresses itinérantes', isCorrect: false },
        ],
      },
      {
        question:
          'Parmi ces rois, lequel a précédé immédiatement Béhanzin dans la chronologie du Danxome ?',
        feedback:
          'Glélé est le père et prédécesseur direct de Béhanzin sur le trône d Abomey.',
        difficulty: QuizDifficulty.EXPERT,
        categoryId: categoriesBySlug.histoire,
        isPublished: true,
        options: [
          { label: 'Glélé', isCorrect: true },
          { label: 'Agaja', isCorrect: false },
          { label: 'Houégbadja', isCorrect: false },
          { label: 'Kpengla', isCorrect: false },
        ],
      },
      {
        question: 'Quel est le nom du site palafittique inscrit sur la liste indicative de l UNESCO au Bénin ?',
        feedback:
          'Ganvié, sur le lac Nokoué, est souvent appelé la Venise de l Afrique.',
        difficulty: QuizDifficulty.EXPERT,
        categoryId: categoriesBySlug.culture,
        isPublished: true,
        options: [
          { label: 'Ganvié', isCorrect: true },
          { label: 'Savalou', isCorrect: false },
          { label: 'Kétou', isCorrect: false },
          { label: 'Malanville', isCorrect: false },
        ],
      },
      {
        question: 'Le royaume de Kétou est historiquement associé à quelle aire culturelle majeure ?',
        feedback:
          'Kétou est un centre historique majeur de l aire yoruba.',
        difficulty: QuizDifficulty.EXPERT,
        categoryId: categoriesBySlug.histoire,
        isPublished: true,
        options: [
          { label: 'Yoruba', isCorrect: true },
          { label: 'Haoussa', isCorrect: false },
          { label: 'Peule', isCorrect: false },
          { label: 'Swahilie', isCorrect: false },
        ],
      },
      {
        question: 'Quel couloir écologique transfrontalier inclut la Pendjari au Bénin ?',
        feedback:
          'La Pendjari fait partie du complexe transfrontalier W-Arly-Pendjari.',
        difficulty: QuizDifficulty.EXPERT,
        categoryId: categoriesBySlug.geographie,
        isPublished: true,
        options: [
          { label: 'W-Arly-Pendjari', isCorrect: true },
          { label: 'Virunga-Kahuzi', isCorrect: false },
          { label: 'Okavango-Zambèze', isCorrect: false },
          { label: 'Rift-Albertin', isCorrect: false },
        ],
      },
      {
        question: 'Quel artisanat d Abomey est particulièrement célèbre pour la narration historique ?',
        feedback:
          'Les bas-reliefs d Abomey racontent des événements et symboles des règnes successifs.',
        difficulty: QuizDifficulty.EXPERT,
        categoryId: categoriesBySlug.culture,
        isPublished: true,
        options: [
          { label: 'Bas-reliefs royaux', isCorrect: true },
          { label: 'Tapis de soie', isCorrect: false },
          { label: 'Miniatures en verre', isCorrect: false },
          { label: 'Icônes byzantines', isCorrect: false },
        ],
      },
    ];
  }
}
