import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';
import { CreateTestimonialDto } from './create-testimonial.dto';

export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {
  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439012',
    description:
      'Id of an image Media (owned by this testimonial) to use as the cover photo',
  })
  @IsOptional()
  @IsMongoId()
  coverMedia?: string;

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439013',
    description:
      'Id of a video or audio Media (owned by this testimonial) carrying the testimonial',
  })
  @IsOptional()
  @IsMongoId()
  media?: string;
}
