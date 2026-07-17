import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ValidateNested } from 'class-validator';

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
}
