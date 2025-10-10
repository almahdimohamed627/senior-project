import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FusionAuthClient } from './fusion-auth.client/fusion-auth.client';

@Module({
  imports: [AuthModule],
  controllers: [AppController],
  providers: [AppService, FusionAuthClient],
})
export class AppModule {}
