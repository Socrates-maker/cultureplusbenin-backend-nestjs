import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ValidateNested } from 'class-validator';
import { RAG_LLM_PROVIDERS, type RagLlmProvider } from '../services/rag-llm.factory';

export class ChatFiltersDto {
  @ApiPropertyOptional({ example: 'Atacora', description: 'Filtrer par région du Bénin' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: 'patrimoine-unesco' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class ChatRequestDto {
  @ApiProperty({ example: 'Qui était le roi Béhanzin ?' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  message: string;

  @ApiPropertyOptional({
    description: "Identifiant de conversation existant, pour conserver l'historique. Omis = nouvelle conversation.",
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ type: ChatFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChatFiltersDto)
  filters?: ChatFiltersDto;

  @ApiPropertyOptional({
    enum: RAG_LLM_PROVIDERS,
    description:
      "Modèle générant la réponse : 'openai' ou 'gemini'. Omis = défaut serveur (RAG_LLM_PROVIDER). Si le provider demandé n'a pas de clé configurée, le serveur bascule sur l'autre.",
  })
  @IsOptional()
  @IsIn([...RAG_LLM_PROVIDERS])
  llmProvider?: RagLlmProvider;
}

export class ChatSourceDto {
  @ApiProperty() sourceId: string;
  @ApiProperty() sourceType: string;
  @ApiProperty() sourceTitle: string;
  @ApiProperty({ type: [String] }) mediaUrls: string[];
}

export class ChatResponseDto {
  @ApiProperty() answer: string;
  @ApiProperty({ type: [ChatSourceDto] }) sources: ChatSourceDto[];
  @ApiProperty() conversationId: string;
  @ApiPropertyOptional({
    enum: RAG_LLM_PROVIDERS,
    description: 'Provider ayant généré la réponse ; absent en mode dégradé.',
  })
  llmProvider?: RagLlmProvider;
}

export class LlmProvidersDto {
  @ApiProperty({
    enum: RAG_LLM_PROVIDERS,
    isArray: true,
    description: 'Providers utilisables (clé API configurée côté serveur)',
  })
  available: RagLlmProvider[];

  @ApiPropertyOptional({
    enum: RAG_LLM_PROVIDERS,
    description: 'Provider utilisé quand la requête ne précise rien ; null si aucune clé',
  })
  default: RagLlmProvider | null;
}
