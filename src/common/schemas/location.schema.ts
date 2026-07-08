import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Schema({ _id: false })
export class Location {
  @ApiPropertyOptional({ example: 'Cotonou, Littoral, Bénin' })
  @Prop()
  address?: string;

  @ApiProperty({ example: 6.3703, description: 'Latitude in decimal degrees' })
  @Prop({ required: true })
  latitude: number;

  @ApiProperty({ example: 2.3912, description: 'Longitude in decimal degrees' })
  @Prop({ required: true })
  longitude: number;
}

export const LocationSchema = SchemaFactory.createForClass(Location);
