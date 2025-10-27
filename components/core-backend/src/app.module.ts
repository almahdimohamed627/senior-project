import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PostModule } from './post/post.module';
import { ProfileModule } from './profile/profile.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [AuthModule, PostModule, ProfileModule,    ConfigModule.forRoot({ isGlobal: true }),
    ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
