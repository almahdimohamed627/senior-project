// src/auth/auth.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy'; 
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/role.guard';
import { Reflector } from '@nestjs/core';
import { ProfileModule } from '../profile/profile.module';
import { FusionAuthClientWrapper } from './fusion-auth.client'; // Import here

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule.register({ timeout: 5000 }),
    forwardRef(() => ProfileModule) // 2. غلف الموديول بـ forwardRef
  ],
  controllers: [AuthController],
  providers: [AuthService, FusionAuthClientWrapper, JwtStrategy, JwtAuthGuard, RolesGuard, Reflector],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}