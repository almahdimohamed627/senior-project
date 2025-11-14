import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { AuthService } from 'src/auth/auth.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService,JwtStrategy,ConfigService,AuthService],
})
export class ProfileModule {}
