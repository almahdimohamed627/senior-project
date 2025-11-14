import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PostModule } from './post/post.module';
import { ProfileModule } from './profile/profile.module';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
@Module({
  imports: [AuthModule, PostModule, ProfileModule,  CacheModule.register({
      isGlobal: true,
      ttl: 60,    // القيمة الافتراضية لكل المفاتيح بالثواني
      max: 1000,  // حد أقصى لمفاتيح الذاكرة (اختياري)
    }),  ConfigModule.forRoot({ isGlobal: true }),
    ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
