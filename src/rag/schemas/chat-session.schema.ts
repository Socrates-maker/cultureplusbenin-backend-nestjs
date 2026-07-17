import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

export type ChatSessionDocument = ChatSession & Document;

@Schema({ _id: false })
export class ChatMessage {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  @ApiProperty({ enum: ['user', 'assistant'], description: "Rôle de l'auteur du message ('user' ou 'assistant')" })
  role: 'user' | 'assistant';

  @Prop({ required: true })
  @ApiProperty({ description: "Contenu du message" })
  content: string;

  
  @Prop({ type: [Object], default: [] })
  @ApiProperty({ type: [Object], description: "Sources associées au message (ex: citations, références)" })
  sources: { sourceId: string; sourceType: string; sourceTitle: string }[];

  @Prop({ default: () => new Date() })
  createdAt: Date;
}
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

@Schema({ timestamps: true, collection: 'chat_sessions' })
export class ChatSession {
  // Si l'utilisateur est authentifié on lie la session à son compte (UsersModule),
  // sinon on autorise les sessions anonymes identifiées par un UUID côté client
  @Prop()
  userId?: string;

  @Prop({ required: true, unique: true })
  conversationId: string;

  @Prop({ type: [ChatMessageSchema], default: [] })
  messages: ChatMessage[];
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
