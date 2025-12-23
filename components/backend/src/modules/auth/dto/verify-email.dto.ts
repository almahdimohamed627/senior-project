import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @IsString() @IsNotEmpty()
  verificationId: string;

  @IsString() @IsNotEmpty()
  code: string;
}