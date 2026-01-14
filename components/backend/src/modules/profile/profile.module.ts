import { Module, forwardRef } from '@nestjs/common'; // 1. استيراد forwardRef
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { JwtStrategy } from 'src/modules/auth/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { FusionAuthClientWrapper } from 'src/modules/auth/fusion-auth.client';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
  imports: [
    forwardRef(() => AuthModule) // 2. غلف الموديول بـ forwardRef
  ], 
  controllers: [ProfileController],
  providers: [
    ProfileService,
    JwtStrategy,
    ConfigService,
    FusionAuthClientWrapper 
  ],
  exports: [ProfileService],  
})
export class ProfileModule {}