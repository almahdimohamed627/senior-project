// src/profile/dto/availability.dto.ts
import { IsInt, Min, Max, IsString, Matches, ArrayNotEmpty, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityItemDto {
  @ApiProperty({ example: 1, description: 'Day of week (0-6)' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  // HH:mm 24-hour
  @ApiProperty({ example: '09:00', description: 'Start time (HH:mm)' })
  @IsString()
  @Matches(/^([0-1]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be HH:MM (24-hour)' })
  startTime: string;

  @ApiProperty({ example: '17:00', description: 'End time (HH:mm)' })
  @IsString()
  @Matches(/^([0-1]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be HH:MM (24-hour)' })
  endTime: string;
}

export class UpsertAvailabilitiesDto {
  @ApiProperty({ type: [AvailabilityItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityItemDto)
  items: AvailabilityItemDto[];
}
