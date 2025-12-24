import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { JwtStrategy } from 'src/modules/auth/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { AuthService } from 'src/modules/auth/auth.service';
import { AuthModule } from '../auth/auth.module';






@Module({
  imports:[AuthModule],
  controllers: [PostController],
  providers: [PostService,JwtStrategy,ConfigService],
  
})
export class PostModule {}

