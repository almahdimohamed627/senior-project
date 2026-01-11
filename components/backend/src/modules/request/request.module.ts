import { Module } from '@nestjs/common';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { ChatService } from 'src/modules/chat/chat.service';
import { NotificationService } from '../notification/notification.service';

@Module({
  controllers: [RequestController],
  providers: [RequestService,ChatService,NotificationService],
  // imports:[NotificationService],
    exports: [ChatService],
})
export class RequestModule {}
