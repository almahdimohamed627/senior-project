import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import {ChatGateway} from './chatgetway'
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/role.guard';
import { NotificationService } from '../notification/notification.service';
@Module({
   controllers: [ChatController],
  providers: [ChatService, ChatGateway,NotificationService],
  exports: [ChatService],
})
export class ChatModule {}
