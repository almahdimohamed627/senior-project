import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { JwtStrategy } from 'src/modules/auth/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { AuthService } from 'src/modules/auth/auth.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService,JwtStrategy,ConfigService,AuthService],
})
export class ProfileModule {}
