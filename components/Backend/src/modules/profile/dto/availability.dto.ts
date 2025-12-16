// src/profile/dto/availability.dto.ts
import { IsInt, Min, Max, IsString, Matches, ArrayNotEmpty, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class AvailabilityItemDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  // HH:mm 24-hour
  @IsString()
  @Matches(/^([0-1]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be HH:MM (24-hour)' })
  startTime: string;

  @IsString()
  @Matches(/^([0-1]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be HH:MM (24-hour)' })
  endTime: string;
}

export class UpsertAvailabilitiesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityItemDto)
  items: AvailabilityItemDto[];
}
