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

export class RegisterDto {
  @IsString() @IsNotEmpty()@IsEmail()email: string;

 @IsString()
@IsNotEmpty()
@MinLength(8)
password: string;
  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;

  @IsNotEmpty()
  @IsIn(['doctor', 'patient'])
  role: 'doctor' | 'patient';

  // -------------------------
  // حقول عامة (مش مكررة)
  // -------------------------
  // profilePhoto ممكن تكون اختيارية للجميع


  @IsNotEmpty() @IsString() gender?: string;
  @IsNotEmpty()  city?: number;

  // phoneNumber مطلوب لكلا الدورين بحسب منطقك السابق، لذا نحافظ عليه كحقل محتمل مطلوب
  // استخدمت IsPhoneNumber (يمكنك ضبط البلد إن أردت) — إن لم ترغب استخدم @IsString()
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  // -------------------------
  // birthYear (تعريف واحد فقط)
  // مطلوب حسب منطقك — إن أردت جعله شرطياً استبدل ValidateIf بالشكل المناسب
  // نستخدم class-transformer لتحويل القيمة إلى Number قبل التحقق
  // -------------------------
  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  birthYear: number;


   @IsString()
    @IsUrl()
    @IsOptional()
    profilePhoto?: string;
  // -------------------------
  // حقول خاصة بالطبيب (validated only if role === 'doctor')
  // -------------------------
  @ValidateIf(o => o.role === 'doctor')
  @IsString()
  @IsNotEmpty()
  university: string;

  @ValidateIf(o => o.role === 'doctor')
  @IsString()
  @IsNotEmpty()
  specialty: string;
}
