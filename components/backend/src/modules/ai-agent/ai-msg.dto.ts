import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export enum DentistSpecialty {
  Restorative = 'Restorative',
  Endodontics = 'Endodontics',
  Periodentics = 'Periodentics',
  Fixed_Prosthondontics = 'Fixed_Prosthondontics',
  Removable_Prosthondontics = 'Removable_Prosthondontics',
  Pediatric_Dentistry = 'Pediatric_Dentistry',
}

export class AiMessage {

  @IsString()
  @IsNotEmpty()
  msg: string;

  @IsString()
  @IsNotEmpty()
  AiResponse: string;

  @IsNotEmpty()
  conversationId: number; 
  
  @IsOptional() 
  @IsBoolean()
  isFinal?: boolean;

  @IsOptional() 
  @IsEnum(DentistSpecialty) 
  speciality?: DentistSpecialty;
}