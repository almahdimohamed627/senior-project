// src/auth/dto/register.dto.ts
import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  IsNotEmpty,
  ValidateIf,
  IsUrl,
  IsEmail,
  Length,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsString() @IsNotEmpty()@IsEmail()email: string;

  @ApiProperty({ example: 'password123', description: 'User password (min 8 chars)', minLength: 8 })
 @IsString()
@IsNotEmpty()
@MinLength(8)
password: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString() @IsNotEmpty() firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString() @IsNotEmpty() lastName: string;

  @ApiProperty({ example: 'patient', enum: ['doctor', 'patient'], description: 'User role' })
  @IsNotEmpty()
  @IsIn(['doctor', 'patient'])
  role: 'doctor' | 'patient';

  // -------------------------
  // حقول عامة (مش مكررة)
  // -------------------------
  // profilePhoto ممكن تكون اختيارية للجميع

  @ApiPropertyOptional({ example: 'male', description: 'Gender' })
  @IsNotEmpty() @IsString() gender?: string;

  @ApiPropertyOptional({ example: 1, description: 'City ID' })
  @IsNotEmpty() @IsString() city?: number;

  // phoneNumber مطلوب لكلا الدورين بحسب منطقك السابق، لذا نحافظ عليه كحقل محتمل مطلوب
  // استخدمت IsPhoneNumber (يمكنك ضبط البلد إن أردت) — إن لم ترغب استخدم @IsString()
  @ApiProperty({ example: '+1234567890', description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  // -------------------------
  // birthYear (تعريف واحد فقط)
  // مطلوب حسب منطقك — إن أردت جعله شرطياً استبدل ValidateIf بالشكل المناسب
  // نستخدم class-transformer لتحويل القيمة إلى Number قبل التحقق
  // -------------------------
  @ApiProperty({ example: 1990, description: 'Birth year' })
  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  birthYear: number;


    @ApiPropertyOptional({ example: 'https://example.com/photo.jpg', description: 'Profile photo URL' })
   @IsString()
    @IsUrl()
    @IsOptional()
    profilePhoto?: string;
  // -------------------------
  // حقول خاصة بالطبيب (validated only if role === 'doctor')
  // -------------------------
  @ApiPropertyOptional({ example: 'Medical University', description: 'University name (Doctors only)' })
  @ValidateIf(o => o.role === 'doctor')
  @IsString()
  @IsNotEmpty()
  university: string;

  @ApiPropertyOptional({ example: 'Cardiology', description: 'Specialty (Doctors only)' })
  @ValidateIf(o => o.role === 'doctor')
  @IsString()
  @IsNotEmpty()
  specialty: string;
}
