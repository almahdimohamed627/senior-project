import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ example: 'some-verification-id', description: 'Verification ID' })
  @IsString() @IsNotEmpty()
  verificationId: string;

  @ApiProperty({ example: '123456', description: 'Verification code' })
  @IsString() @IsNotEmpty()
  code: string;
}