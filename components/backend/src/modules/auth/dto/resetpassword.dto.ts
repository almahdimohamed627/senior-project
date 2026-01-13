import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'oldPassword123', description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  oldPassword: string;

  @ApiProperty({ example: 'newPassword123', description: 'New password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({ example: 'newPassword123', description: 'Confirm new password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  confirmNewPassword: string;
}