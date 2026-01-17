import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { AuthService } from '../auth/auth.service';
import { FusionAuthClientWrapper } from '../auth/fusion-auth.client';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService,JwtAuthGuard,RolesGuard,AuthService,FusionAuthClientWrapper],
})
export class NotificationModule {}
