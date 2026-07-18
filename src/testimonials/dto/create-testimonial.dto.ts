import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNotEmpty, IsString } from 'class-validator';
import { TagsField } from '../../common/decorators/tags-field.decorator';
import { TestimonialSubjectType } from '../../common/enums/testimonial.enum';

export class CreateTestimonialDto {
  @ApiProperty({ example: 'Un lieu qui a changé ma vision de l’histoire' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'En visitant ce site, j’ai ressenti toute la mémoire du lieu…',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    enum: TestimonialSubjectType,
    example: TestimonialSubjectType.TOURIST_SITE,
    description: 'Kind of entity this testimonial is about',
  })
  @IsEnum(TestimonialSubjectType)
  subjectType: TestimonialSubjectType;

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description:
      'Id of the city, tourist site or historical figure this testimonial is about',
  })
  @IsMongoId()
  subject: string;

  @TagsField()
  tags?: string[];
}
