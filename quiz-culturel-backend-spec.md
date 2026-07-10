# Spécification backend — Jeu "Quiz Culturel"

Plateforme CulturePlus Bénin — Module `quiz`
Stack cible : **NestJS + MongoDB + @nestjs/mongoose**

Ce document décrit tout ce qui doit être créé côté backend pour implémenter le jeu Quiz Culturel, en respectant la convention de structure déjà utilisée dans le module `users` du projet (dossier `dto/`, dossier `schemas/`, `*.controller.ts`, `*.module.ts`, `*.service.ts`).

Le frontend existant (composant `QuizGame.tsx`) attend un format de données précis, détaillé plus bas. **Aucune structure de réponse ne doit s'écarter de ce contrat** sans validation préalable.

---

## 1. Arborescence à créer

```
src/
  quiz/
    dto/
      create-quiz-question.dto.ts
      update-quiz-question.dto.ts
      create-quiz-category.dto.ts
      get-quiz-questions.dto.ts
      submit-quiz-attempt.dto.ts
    schemas/
      quiz-category.schema.ts
      quiz-question.schema.ts
      quiz-attempt.schema.ts
      user-quiz-best-score.schema.ts
    quiz.controller.ts
    quiz-admin.controller.ts
    quiz.module.ts
    quiz.service.ts
```

Deux contrôleurs séparés :
- `quiz.controller.ts` → routes publiques/joueur (`/quiz/*`)
- `quiz-admin.controller.ts` → routes de gestion du contenu (`/admin/quiz/*`), protégées par rôle admin

---

## 2. Contrat frontend à respecter (ne pas casser)

Le composant `QuizGame.tsx` consomme `quizRepository.getQuestions()` et attend un tableau de cette forme exacte :

```ts
interface QuizQuestion {
  id: string;
  question: string;
  feedback: string;
  options: {
    id: string;
    label: string;
    isCorrect: boolean;
  }[];
}
```

Décision produit validée : pour le MVP, **`isCorrect` est bien renvoyé au client** (la correction se fait côté frontend pour l'affichage immédiat). Le score qui compte officiellement pour le leaderboard et le "meilleur score" est recalculé et validé **côté serveur** lors de la soumission finale (`POST /quiz/attempts`), pas fait confiance au score envoyé par le client.

La réponse de `GET /quiz/questions` doit donc être un tableau `QuizQuestion[]` strictement conforme au type ci-dessus (mapper `_id` Mongo → `id` string dans le DTO de sortie).

---

## 3. Schémas Mongoose

### 3.1 `quiz-category.schema.ts`

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type QuizCategoryDocument = HydratedDocument<QuizCategory>;

@Schema({ timestamps: true })
export class QuizCategory {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  description?: string;
}

export const QuizCategorySchema = SchemaFactory.createForClass(QuizCategory);
```

### 3.2 `quiz-question.schema.ts`

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QuizQuestionDocument = HydratedDocument<QuizQuestion>;

export enum QuizDifficulty {
  FACILE = 'facile',
  INTERMEDIAIRE = 'intermediaire',
  EXPERT = 'expert',
}

@Schema({ _id: true })
export class QuizOption {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true, default: false })
  isCorrect: boolean;

  @Prop({ default: 0 })
  order: number;
}

@Schema({ timestamps: true })
export class QuizQuestion {
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  feedback: string;

  @Prop({ required: true, enum: QuizDifficulty, type: String })
  difficulty: QuizDifficulty;

  @Prop({ type: Types.ObjectId, ref: 'QuizCategory' })
  categoryId?: Types.ObjectId;

  @Prop({ type: [QuizOption], required: true, validate: [(v: QuizOption[]) => v.length >= 2, 'Au moins 2 options requises'] })
  options: QuizOption[];

  @Prop({ default: true })
  isPublished: boolean;
}

export const QuizQuestionSchema = SchemaFactory.createForClass(QuizQuestion);

// Règle métier à valider en pre-save hook ou dans le service :
// - au moins une option doit avoir isCorrect: true
// - une seule option correcte par question (mode QCM simple)
```

### 3.3 `quiz-attempt.schema.ts`

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { QuizDifficulty } from './quiz-question.schema';

export type QuizAttemptDocument = HydratedDocument<QuizAttempt>;

@Schema()
export class QuizAnswerEntry {
  @Prop({ type: Types.ObjectId, ref: 'QuizQuestion', required: true })
  questionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  optionId: Types.ObjectId;
}

@Schema({ timestamps: true })
export class QuizAttempt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: QuizDifficulty, type: String })
  difficulty: QuizDifficulty;

  @Prop({ required: true })
  score: number; // calculé serveur, source de vérité

  @Prop({ required: true })
  total: number;

  @Prop({ type: [QuizAnswerEntry], required: true })
  answers: QuizAnswerEntry[];
}

export const QuizAttemptSchema = SchemaFactory.createForClass(QuizAttempt);
```

### 3.4 `user-quiz-best-score.schema.ts`

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { QuizDifficulty } from './quiz-question.schema';

export type UserQuizBestScoreDocument = HydratedDocument<UserQuizBestScore>;

@Schema({ timestamps: true })
export class UserQuizBestScore {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: QuizDifficulty, type: String })
  difficulty: QuizDifficulty;

  @Prop({ required: true })
  bestScore: number;

  @Prop({ required: true })
  bestTotal: number;

  @Prop({ default: 0 })
  playedCount: number;
}

export const UserQuizBestScoreSchema = SchemaFactory.createForClass(UserQuizBestScore);

// Index composé unique à définir dans le module :
// schema.index({ userId: 1, difficulty: 1 }, { unique: true });
```

---

## 4. DTOs

### 4.1 `get-quiz-questions.dto.ts` (query params, route joueur)

```ts
import { IsEnum, IsOptional, IsMongoId, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { QuizDifficulty } from '../schemas/quiz-question.schema';

export class GetQuizQuestionsDto {
  @IsEnum(QuizDifficulty)
  difficulty: QuizDifficulty;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number = 10;
}
```

### 4.2 `submit-quiz-attempt.dto.ts`

```ts
import { IsEnum, IsArray, ValidateNested, IsMongoId, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { QuizDifficulty } from '../schemas/quiz-question.schema';

class AnswerEntryDto {
  @IsMongoId()
  questionId: string;

  @IsMongoId()
  optionId: string;
}

export class SubmitQuizAttemptDto {
  @IsEnum(QuizDifficulty)
  difficulty: QuizDifficulty;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerEntryDto)
  answers: AnswerEntryDto[];
}
```

### 4.3 `create-quiz-question.dto.ts` (admin)

```ts
import { IsString, IsEnum, IsOptional, IsMongoId, IsArray, ValidateNested, ArrayMinSize, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { QuizDifficulty } from '../schemas/quiz-question.schema';

class QuizOptionDto {
  @IsString()
  label: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class CreateQuizQuestionDto {
  @IsString()
  question: string;

  @IsString()
  feedback: string;

  @IsEnum(QuizDifficulty)
  difficulty: QuizDifficulty;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options: QuizOptionDto[];
}
```

### 4.4 `update-quiz-question.dto.ts`

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateQuizQuestionDto } from './create-quiz-question.dto';

export class UpdateQuizQuestionDto extends PartialType(CreateQuizQuestionDto) {}
```

### 4.5 `create-quiz-category.dto.ts`

```ts
import { IsString, IsOptional } from 'class-validator';

export class CreateQuizCategoryDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

---

## 5. Règles métier côté service (`quiz.service.ts`)

### `getQuestions(dto: GetQuizQuestionsDto)`
1. Filtrer `QuizQuestion` par `difficulty`, `isPublished: true`, et `categoryId` si fourni.
2. Utiliser `$sample` (aggregation Mongo) pour tirer aléatoirement `limit` questions — plus performant et plus "vraiment aléatoire" qu'un `.sort()` sur tout le corpus :
   ```ts
   this.quizQuestionModel.aggregate([
     { $match: { difficulty, isPublished: true, ...(categoryId && { categoryId }) } },
     { $sample: { size: limit } },
   ]);
   ```
3. Pour chaque question retournée, **mélanger l'ordre des options** en mémoire (`Array.sort(() => Math.random() - 0.5)` ou un shuffle Fisher-Yates) avant de les renvoyer, afin que la bonne réponse ne soit pas toujours en première position.
4. Mapper vers le DTO de sortie `QuizQuestionResponseDto` (voir §6) qui convertit `_id` → `id` (string) et respecte exactement le contrat frontend.

### `submitAttempt(userId: string, dto: SubmitQuizAttemptDto)`
1. Récupérer en base les `QuizQuestion` correspondant aux `questionId` envoyés.
2. Pour chaque paire `{questionId, optionId}`, vérifier si l'`optionId` correspond bien à une option de la question **et** si `isCorrect === true`. Ignorer totalement tout score envoyé par le client — le calcul est intégralement reconstruit serveur.
3. `score = nombre de bonnes réponses`, `total = answers.length`.
4. Créer un document `QuizAttempt` (traçabilité / anti-triche / futures stats).
5. Chercher un `UserQuizBestScore` existant pour `(userId, difficulty)` :
   - s'il n'existe pas → le créer avec `bestScore = score`.
   - s'il existe et que `score > bestScore` → mettre à jour.
   - Toujours incrémenter `playedCount`.
6. Retourner `{ score, total, isNewBest: boolean, bestScore: number }`.

### `getBestScore(userId: string, difficulty: QuizDifficulty)`
Retourne le document `UserQuizBestScore` correspondant, ou un objet par défaut `{ bestScore: 0, bestTotal: 0, playedCount: 0 }` si aucun enregistrement.

### `getLeaderboard(difficulty: QuizDifficulty, limit = 10)`
Requête `UserQuizBestScore` triée par `bestScore` décroissant, `populate` sur `userId` pour récupérer nom/avatar (adapter selon les champs réels du schéma `User`), limité à `limit`.

### Admin : `createQuestion`, `updateQuestion`, `deleteQuestion`, `listQuestions` (avec pagination et filtre `isPublished`), `createCategory`, `listCategories`
CRUD classique, avec validation métier supplémentaire dans `createQuestion`/`updateQuestion` : **rejeter si aucune option n'a `isCorrect: true`, ou si plus d'une option a `isCorrect: true`** (mode QCM à réponse unique pour ce MVP).

---

## 6. DTO de réponse (mapping vers le contrat frontend)

```ts
// quiz-question-response.dto.ts (à ajouter dans dto/)
export class QuizOptionResponseDto {
  id: string;
  label: string;
  isCorrect: boolean;
}

export class QuizQuestionResponseDto {
  id: string;
  question: string;
  feedback: string;
  options: QuizOptionResponseDto[];
}
```

Fonction de mapping à écrire dans le service (ou un mapper dédié) :

```ts
function toQuestionResponse(doc: QuizQuestionDocument): QuizQuestionResponseDto {
  return {
    id: doc._id.toString(),
    question: doc.question,
    feedback: doc.feedback,
    options: shuffle(doc.options).map((opt) => ({
      id: opt._id.toString(),
      label: opt.label,
      isCorrect: opt.isCorrect,
    })),
  };
}
```

---

## 7. Routes — `quiz.controller.ts` (joueur, protégé par le guard JWT existant)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/quiz/questions` | JWT requis | Query: `difficulty` (requis), `categoryId?`, `limit?`. Retourne `QuizQuestionResponseDto[]` |
| POST | `/quiz/attempts` | JWT requis | Body: `SubmitQuizAttemptDto`. Retourne `{ score, total, isNewBest, bestScore }` |
| GET | `/quiz/best-score` | JWT requis | Query: `difficulty`. Retourne le meilleur score de l'utilisateur courant |
| GET | `/quiz/leaderboard` | Public ou JWT | Query: `difficulty`, `limit?`. Retourne le classement |
| GET | `/quiz/categories` | Public | Liste des catégories disponibles (pour un futur filtre côté UI) |

Squelette :

```ts
@UseGuards(JwtAuthGuard) // réutiliser le guard déjà existant dans le module Auth
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('questions')
  getQuestions(@Query() dto: GetQuizQuestionsDto) {
    return this.quizService.getQuestions(dto);
  }

  @Post('attempts')
  submitAttempt(@CurrentUser() user: User, @Body() dto: SubmitQuizAttemptDto) {
    return this.quizService.submitAttempt(user.id, dto);
  }

  @Get('best-score')
  getBestScore(@CurrentUser() user: User, @Query('difficulty') difficulty: QuizDifficulty) {
    return this.quizService.getBestScore(user.id, difficulty);
  }

  @Get('leaderboard')
  getLeaderboard(@Query('difficulty') difficulty: QuizDifficulty, @Query('limit') limit?: number) {
    return this.quizService.getLeaderboard(difficulty, limit);
  }

  @Get('categories')
  getCategories() {
    return this.quizService.getCategories();
  }
}
```

> ⚠️ Adapter `JwtAuthGuard` et `@CurrentUser()` aux noms réels déjà présents dans le module `Auth`/`Users` du projet — reprendre exactement ce qui est utilisé sur les routes existantes protégées.

---

## 8. Routes — `quiz-admin.controller.ts` (gestion de contenu, réservé admin)

| Méthode | Route | Description |
|---|---|---|
| POST | `/admin/quiz/questions` | Créer une question |
| PATCH | `/admin/quiz/questions/:id` | Modifier une question |
| DELETE | `/admin/quiz/questions/:id` | Supprimer une question |
| GET | `/admin/quiz/questions` | Lister toutes les questions (pagination, filtre difficulté/catégorie/publié) |
| POST | `/admin/quiz/categories` | Créer une catégorie |
| GET | `/admin/quiz/categories` | Lister les catégories |

Protéger avec le guard/rôle admin déjà utilisé ailleurs dans le projet (`@Roles('admin')` ou équivalent — à adapter selon l'implémentation existante).

---

## 9. `quiz.module.ts`

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizController } from './quiz.controller';
import { QuizAdminController } from './quiz-admin.controller';
import { QuizService } from './quiz.service';
import { QuizCategory, QuizCategorySchema } from './schemas/quiz-category.schema';
import { QuizQuestion, QuizQuestionSchema } from './schemas/quiz-question.schema';
import { QuizAttempt, QuizAttemptSchema } from './schemas/quiz-attempt.schema';
import { UserQuizBestScore, UserQuizBestScoreSchema } from './schemas/user-quiz-best-score.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuizCategory.name, schema: QuizCategorySchema },
      { name: QuizQuestion.name, schema: QuizQuestionSchema },
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
      { name: UserQuizBestScore.name, schema: UserQuizBestScoreSchema },
    ]),
  ],
  controllers: [QuizController, QuizAdminController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
```

Et l'ajouter dans les `imports` de `app.module.ts`.

**Index à créer** (dans le schéma ou via `schema.index(...)` dans `quiz.module.ts` avant `MongooseModule.forFeature`) :
```ts
UserQuizBestScoreSchema.index({ userId: 1, difficulty: 1 }, { unique: true });
QuizQuestionSchema.index({ difficulty: 1, isPublished: 1 });
```

---

## 10. Jeu de données de test (seed)

Prévoir un script ou un endpoint temporaire `/admin/quiz/seed` (à supprimer avant prod) injectant 5 à 10 questions de test par niveau, par exemple :

```json
{
  "question": "Quel roi d'Abomey est connu pour avoir résisté à la colonisation française ?",
  "feedback": "Béhanzin, dernier grand roi d'Abomey, a mené la résistance contre la France entre 1892 et 1894.",
  "difficulty": "intermediaire",
  "options": [
    { "label": "Béhanzin", "isCorrect": true },
    { "label": "Ghézo", "isCorrect": false },
    { "label": "Agaja", "isCorrect": false },
    { "label": "Tegbessou", "isCorrect": false }
  ]
}
```

---

## 11. Ce qui reste hors scope de ce document (à faire côté frontend, séparément)

- Adapter `quizRepository` pour appeler `GET /quiz/questions?difficulty=...`
- Ajouter un state `answers` dans `QuizGame.tsx` (accumulé à chaque `handlePick`) et appeler `POST /quiz/attempts` dans la branche finale de `handleNext`
- Ajouter un sélecteur de difficulté en amont du composant (facile/intermédiaire/expert) s'il n'existe pas déjà
- Afficher le meilleur score (`GET /quiz/best-score`) quelque part dans l'écran de fin de quiz

---

## 12. Checklist de livraison backend

- [ ] 4 schémas Mongoose créés et enregistrés dans `quiz.module.ts`
- [ ] Index uniques et de filtre créés
- [ ] 5 DTOs créés avec validation `class-validator`
- [ ] `quiz.service.ts` avec les 8 méthodes décrites au §5
- [ ] Mapping `_id` → `id` respecté partout dans les réponses joueur
- [ ] Score recalculé serveur, jamais fait confiance au client
- [ ] Shuffle des options appliqué à chaque `GET /quiz/questions`
- [ ] Guards JWT/admin réutilisés depuis le module `Auth` existant (pas de nouvelle logique d'auth)
- [ ] Seed de test avec au moins 5 questions par niveau de difficulté
- [ ] `QuizModule` importé dans `app.module.ts`
