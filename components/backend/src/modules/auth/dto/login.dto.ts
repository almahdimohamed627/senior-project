import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsString()
  @IsEmail()
  email: string;
  
  @ApiProperty({ example: 'password123', description: 'User password', minLength: 8 })
   @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

