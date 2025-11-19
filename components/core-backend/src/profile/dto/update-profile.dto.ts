// src/profile/dto/update-profile.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateProfileDto } from './create-profile.dto';
import { IsEmail, IsOptional, IsString, IsUrl, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto extends PartialType(CreateProfileDto) {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsString()
  @IsUrl()
  @IsOptional()
  profilePhoto?: string; // في حال جاء كرابط جاهز

    @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  gender?: string;

    @IsOptional()
    @IsString()
    university?: string;
  @IsOptional()
    @IsString()
    specialty?: string;
}
