// src/post/dto/create-post.dto.ts
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PhotoDto {
  @IsString()
  url: string;

  @IsOptional()
  order?: number;
}

export class CreatePostDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos?: PhotoDto[];

  // لا تضيف authorId هنا — سيأتي من req.user في الكONTROLLER
}
