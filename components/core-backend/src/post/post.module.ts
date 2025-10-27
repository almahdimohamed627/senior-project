import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { AuthService } from 'src/auth/auth.service';






@Module({
  controllers: [PostController],
  providers: [PostService,JwtStrategy,ConfigService,AuthService],
  
})
export class PostModule {}

