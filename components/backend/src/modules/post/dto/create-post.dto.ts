// src/post/dto/create-post.dto.ts
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PhotoDto {
  @IsString()
  url: string;

  @IsOptional()
  order?: number;
}

export class CreatePostDto {
  @ApiProperty({ example: 'My Post Title', description: 'Post title' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'This is the content...', description: 'Post content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Photos (handled via multipart upload usually)', type: [PhotoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos?: PhotoDto[];

  // لا تضيف authorId هنا — سيأتي من req.user في الكONTROLLER
}
