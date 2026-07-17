import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import { RagRetrievalService, RetrievedChunk } from './services/rag-retrieval.service';
import { ChatSession, ChatSessionDocument } from './schemas/chat-session.schema';

export interface ChatResult {
  answer: string;
  sources: { sourceId: string; sourceType: string; sourceTitle: string; mediaUrls: string[] }[];
  conversationId: string;
}

const SYSTEM_PROMPT = `Tu es l'assistant culturel de la plateforme CulturePlus Bénin.
Ton rôle est d'aider les utilisateurs à découvrir la culture, l'histoire et le patrimoine du Bénin.

RÈGLES STRICTES :
- Réponds UNIQUEMENT à partir des informations renvoyées par tes outils (semantic_search, browse_content).
- Si aucune information pertinente n'est trouvée, dis clairement que tu ne disposes pas de cette
  information sur la plateforme, plutôt que d'inventer une réponse.
- N'invente jamais de dates, de noms ou de faits historiques.
- Utilise browse_content quand l'utilisateur veut explorer/découvrir du contenu par thème,
  région ou catégorie plutôt que poser une question factuelle précise.
- Utilise semantic_search pour les questions factuelles précises.
- Réponds en français, dans un ton chaleureux et pédagogique, adapté à un public grand public.
- Reste concis : 3 à 6 phrases sauf si l'utilisateur demande plus de détails.`;

@Injectable()
export class RagChatService {
  private readonly llm: ChatOpenAI;
  private readonly hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  constructor(
    private readonly retrievalService: RagRetrievalService,
    @InjectModel(ChatSession.name) private readonly chatSessionModel: Model<ChatSessionDocument>,
  ) {
    this.llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0.3 });
  }

  async chat(
    message: string,
    conversationId?: string,
    filters?: { region?: string; category?: string },
  ): Promise<ChatResult> {
    const convoId = conversationId ?? uuidv4();
    const session = await this.getOrCreateSession(convoId);

    const retrievedChunks = await this.retrieveRelevantChunks(message, filters);
    const answer = await this.generateAnswer(message, session.messages.slice(-10), retrievedChunks);

    // Dédoublonnage des sources par sourceId
    const uniqueSources = Array.from(new Map(retrievedChunks.map((c) => [c.sourceId, c])).values()).map((c) => ({
      sourceId: c.sourceId,
      sourceType: c.sourceType,
      sourceTitle: c.sourceTitle,
      mediaUrls: c.mediaUrls,
    }));

    await this.persistExchange(session, message, answer, uniqueSources);

    return { answer, sources: uniqueSources, conversationId: convoId };
  }

  private shouldBrowseContent(message: string, filters?: { region?: string; category?: string }) {
    if (filters?.region || filters?.category) {
      return true;
    }

    const normalizedMessage = message.toLowerCase();
    return /\b(montre|liste|liste-moi|découvre|decouvre|explore|trouve|voir|présente|presente|quels sont|quoi voir|contenu|par région|par categorie|par catégorie)\b/.test(
      normalizedMessage,
    );
  }

  private async retrieveRelevantChunks(
    message: string,
    filters?: { region?: string; category?: string },
  ): Promise<RetrievedChunk[]> {
    const shouldBrowse = this.shouldBrowseContent(message, filters);

    if (shouldBrowse) {
      const browsedChunks = await this.retrievalService.browseByFilters(filters ?? {}, 10);
      if (browsedChunks.length) {
        return browsedChunks;
      }
    }

    return this.retrievalService.semanticSearch(message, filters, 6);
  }

  private async generateAnswer(
    message: string,
    history: ChatSessionDocument['messages'],
    retrievedChunks: RetrievedChunk[],
  ): Promise<string> {
    if (!this.hasOpenAiKey) {
      if (!retrievedChunks.length) {
        return "Je ne dispose pas d'assez d'informations indexées pour répondre à cette question pour le moment.";
      }

      const summary = retrievedChunks
        .slice(0, 3)
        .map((chunk) => `- ${chunk.sourceTitle} (${chunk.sourceType})`)
        .join('\n');

      return [
        "Je n'ai pas encore la configuration OpenAI requise pour générer une réponse enrichie.",
        'Voici les contenus indexés les plus proches de votre demande :',
        summary,
      ].join('\n');
    }

    const historyMessages = history.map((entry) =>
      entry.role === 'assistant' ? new AIMessage(entry.content) : new HumanMessage(entry.content),
    );

    const context = retrievedChunks.length
      ? retrievedChunks
          .map((chunk) => `[${chunk.sourceTitle}] (${chunk.sourceType}): ${chunk.content}`)
          .join('\n---\n')
      : "Aucun contexte pertinent n'a été trouvé dans la base de connaissances.";

    const response = await this.llm.invoke([
      new SystemMessage(
        `${SYSTEM_PROMPT}\n\nCONTEXTE DISPONIBLE:\n${context}\n\nConsigne finale: réponds uniquement à partir du contexte ci-dessus. Si le contexte ne suffit pas, dis clairement que tu ne disposes pas de l'information sur la plateforme.`,
      ),
      ...historyMessages,
      new HumanMessage(message),
    ]);

    return this.extractTextContent(response.content);
  }

  private extractTextContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }

          if (part && typeof part === 'object' && 'text' in part) {
            return String((part as { text?: string }).text ?? '');
          }

          return '';
        })
        .join('');
    }

    return content == null ? '' : String(content);
  }

  private async getOrCreateSession(conversationId: string): Promise<ChatSessionDocument> {
    let session = await this.chatSessionModel.findOne({ conversationId });
    if (!session) {
      session = await this.chatSessionModel.create({ conversationId, messages: [] });
    }
    return session;
  }

  private async persistExchange(
    session: ChatSessionDocument,
    userMessage: string,
    assistantAnswer: string,
    sources: ChatResult['sources'],
  ) {
    session.messages.push(
      { role: 'user', content: userMessage, sources: [], createdAt: new Date() },
      { role: 'assistant', content: assistantAnswer, sources, createdAt: new Date() },
    );
    await session.save();
  }
}
