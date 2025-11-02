// src/auth/dto/register.dto.ts
import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  IsNotEmpty,
  ValidateIf,
  IsPhoneNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterDto {
  @IsString() @IsNotEmpty() email: string;
  @IsString() @IsNotEmpty() password: string;
  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;

  @IsIn(['doctor', 'patient'])
  role: 'doctor' | 'patient';

  // -------------------------
  // حقول عامة (مش مكررة)
  // -------------------------
  // profilePhoto ممكن تكون اختيارية للجميع


  // gender, city يمكن أن تكون اختيارية أو مطلوبة حسب حاجتك — هنا جعلتها اختيارية
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() city?: string;

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
  @IsInt()
  birthYear: number;

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
