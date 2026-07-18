import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RagChatService } from './services/rag-chat.service';
import { RagIngestionService } from './services/rag-ingestion.service';
import { RagChunk, RagChunkDocument } from './schemas/rag-chunk.schema';
import { ChatRequestDto, ChatResponseDto, LlmProvidersDto } from './dto/chat.dto';
import { availableRagProviders, resolveRagProvider } from './services/rag-llm.factory';
import { ReindexParamsDto, ReindexResultDto, IndexStatusDto } from './dto/reindex.dto';
// TODO: adapter ces imports à vos guards/décorateurs existants (AuthModule/CaslModule)
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';

@ApiTags('RAG - Chatbot culturel')
@Controller('rag')
export class RagController {
  constructor(
    private readonly chatService: RagChatService,
    private readonly ingestionService: RagIngestionService,
    @InjectModel(RagChunk.name) private readonly ragChunkModel: Model<RagChunkDocument>,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Envoyer un message au chatbot culturel' })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  async chat(@Body() dto: ChatRequestDto): Promise<ChatResponseDto> {
    return this.chatService.chat(
      dto.message,
      dto.conversationId,
      dto.filters,
      dto.llmProvider,
    );
  }

  @Get('providers')
  @ApiOperation({
    summary: 'Providers LLM utilisables pour le chat (pour un sélecteur côté front)',
  })
  @ApiResponse({ status: 200, type: LlmProvidersDto })
  providers(): LlmProvidersDto {
    return {
      available: availableRagProviders(),
      default: resolveRagProvider() ?? null,
    };
  }

  // --- Endpoints admin ---

  @Post('admin/reindex/:sourceType')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Réindexer entièrement un type de contenu (admin)' })
  @ApiResponse({ status: 200, type: ReindexResultDto })
  async reindex(@Param() params: ReindexParamsDto): Promise<ReindexResultDto> {
    const result = await this.ingestionService.reindexAll(params.sourceType);
    return { sourceType: params.sourceType, ...result };
  }

  @Get('admin/index-status')
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Voir l'état de l'index RAG (nombre de chunks par type)" })
  @ApiResponse({ status: 200, type: IndexStatusDto })
  async indexStatus(): Promise<IndexStatusDto> {
    const agg = await this.ragChunkModel.aggregate([
      { $group: { _id: '$sourceType', count: { $sum: 1 } } },
    ]);
    const countsBySourceType = Object.fromEntries(agg.map((a) => [a._id, a.count]));
    const totalChunks = agg.reduce((sum, a) => sum + a.count, 0);
    return { countsBySourceType, totalChunks };
  }
}
