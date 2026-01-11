import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PostModule } from './modules/post/post.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { RequestModule } from './modules/request/request.module';
import { ChatModule } from './modules/chat/chat.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { LocationsModule } from './modules/locations/modules/locations/locations.module';
//import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [AuthModule, PostModule, ProfileModule,  CacheModule.register({
      isGlobal: true,
      ttl: 60,    // القيمة الافتراضية لكل المفاتيح بالثواني
      max: 1000,  // حد أقصى لمفاتيح الذاكرة (اختياري)
    }),  ConfigModule.forRoot({ isGlobal: true }), RequestModule, ChatModule, AiAgentModule, LocationsModule, //NotificationModule
    ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
