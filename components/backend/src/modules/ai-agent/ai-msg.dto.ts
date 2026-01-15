import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DentistSpecialty {
  Restorative = 'Restorative',
  Endodontics = 'Endodontics',
  Periodentics = 'Periodontics',
  Fixed_Prosthondontics = 'Fixed_prosthodontics',
  Removable_Prosthondontics = 'Removable_prosthodontics',
  Pediatric_Dentistry = 'Pediatric_dentistry',
}

export class AiMessage {

  @ApiProperty({ example: 'I have a toothache', description: 'User message' })
  @IsString()
  @IsNotEmpty()
  msg: string;

  @ApiProperty({ example: 'You might need a filling', description: 'AI response' })
  @IsString()
  @IsNotEmpty()
  AiResponse: string;

  @ApiProperty({ example: 1, description: 'Conversation ID' })
  @IsNotEmpty()
  conversationId: number; 
  
  @ApiPropertyOptional({ example: false, description: 'Is final message' })
  @IsOptional() 
  @IsBoolean()
  isFinal?: boolean;

  @ApiPropertyOptional({ enum: DentistSpecialty, example: DentistSpecialty.Restorative })
  @IsOptional() 
  @IsEnum(DentistSpecialty) 
  speciality?: DentistSpecialty;
}