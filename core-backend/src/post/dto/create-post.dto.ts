import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUrl,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class PhotoDto {
  @IsUrl({}, { message: 'Invalid image URL' })
  url: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  content: string;

  // authorId هو الـ fusionAuthId أو المعرف الخاص بالدكتور
  @IsString()
  @IsNotEmpty({ message: 'Author ID is required' })
  authorId: string;

  @IsOptional()
  @IsArray({ message: 'Photos must be an array' })
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos?: PhotoDto[];
}
